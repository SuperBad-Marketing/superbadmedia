"""
Audio Tier B: server-side pre-processing via ffmpeg/sox.
Effects that cannot be applied through Resolve's API (EQ, reverb, pitch, distortion).
"""

import os
import subprocess

from resolve_helpers import (
    get_clip, generate_effect_id, build_ffmpeg_filter_chain,
    TEMP_AUDIO_DIR, ensure_temp_dirs, check_ffmpeg,
)


class AudioPreprocessMixin:

    def preprocess_audio(self, source_file_path, start_time, end_time, filters):
        if not check_ffmpeg():
            return {"error": "ffmpeg not found on this system"}

        if not os.path.isfile(source_file_path):
            return {"error": f"Source file not found: {source_file_path}"}

        ensure_temp_dirs()

        filter_chain = build_ffmpeg_filter_chain(filters)
        if not filter_chain:
            return {"error": "No valid filters specified"}

        output_id = generate_effect_id()
        output_path = os.path.join(TEMP_AUDIO_DIR, f"{output_id}.wav")

        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start_time),
            "-to", str(end_time),
            "-i", source_file_path,
            "-af", filter_chain,
            "-ar", "48000",
            "-ac", "2",
            output_path,
        ]

        try:
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=120,
            )

            if result.returncode != 0:
                return {
                    "error": f"ffmpeg failed: {result.stderr[:500]}",
                    "command": " ".join(cmd),
                }

            if not os.path.isfile(output_path):
                return {"error": "ffmpeg produced no output file"}

            filter_types = [f.get("type") for f in filters]
            return {
                "success": True,
                "processed_path": output_path,
                "filters_applied": filter_types,
            }
        except subprocess.TimeoutExpired:
            return {"error": "ffmpeg timed out after 120 seconds"}
        except Exception as e:
            return {"error": str(e)}

    def replace_clip_audio(self, clip_index, processed_audio_path):
        if not self.timeline or not self.media_pool:
            return {"error": "No project/timeline active"}

        if not os.path.isfile(processed_audio_path):
            return {"error": f"Processed audio not found: {processed_audio_path}"}

        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            # Mute original clip audio
            self.mute_clip_audio(clip_index, True)

            # Get clip timeline position for sync
            clip_start = clip.GetStart()

            # Import processed audio
            media_clips = self.media_pool.ImportMedia([processed_audio_path])
            if not media_clips:
                return {"error": "Failed to import processed audio"}

            # Find or create a processed-audio track
            audio_track_count = self.timeline.GetTrackCount("audio")
            target_track = audio_track_count + 1
            self.timeline.AddTrack("audio")
            self.timeline.SetTrackName("audio", target_track, "Processed Audio")

            # Place on track at clip's position
            self.media_pool.AppendToTimeline([{
                "mediaPoolItem": media_clips[0],
                "startFrame": 0,
                "recordFrame": clip_start,
                "trackIndex": target_track,
                "mediaType": 2,
            }])

            effect_id = generate_effect_id()
            self._register_effect(clip_index, {
                "id": effect_id,
                "type": "audio-preprocess",
                "ingredient_id": "replaced_audio",
                "parameters": {"processed_path": processed_audio_path},
                "resolve_ref": {
                    "track_index": target_track,
                    "original_muted": True,
                },
            })

            return {
                "success": True,
                "effect_id": effect_id,
                "track_index": target_track,
                "synced_to_frame": clip_start,
            }
        except Exception as e:
            return {"error": str(e)}
