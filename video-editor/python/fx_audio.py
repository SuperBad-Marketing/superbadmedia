"""
Audio Tier A: Resolve-native audio controls (volume, pan, mute, tracks, SFX placement).
"""

from resolve_helpers import get_clip, generate_effect_id


class AudioFXMixin:

    def set_clip_volume(self, clip_index, volume_db):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            result = clip.SetClipProperty("Volume", volume_db)
            if result:
                return {"success": True, "volume_db": volume_db}
            result = clip.SetProperty("Volume", volume_db)
            return {"success": bool(result), "volume_db": volume_db}
        except Exception as e:
            return {"error": str(e)}

    def set_volume_keyframe(self, clip_index, frame, volume_db):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            try:
                result = clip.SetDynamicProperty("Volume", volume_db, frame)
                if result:
                    return {"success": True, "frame": frame, "volume_db": volume_db}
            except Exception:
                pass

            clip.AddMarker(
                frame, "Green", "Volume",
                f"Set volume to {volume_db}dB", 1
            )
            return {
                "success": False,
                "fallback": "marker_placed",
                "note": f"Volume keyframe API not available. Marker placed at frame {frame}.",
            }
        except Exception as e:
            return {"error": str(e)}

    def set_clip_pan(self, clip_index, pan):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            result = clip.SetClipProperty("Pan", pan)
            if not result:
                result = clip.SetProperty("Pan", pan)
            return {"success": bool(result), "pan": pan}
        except Exception as e:
            return {"error": str(e)}

    def mute_clip_audio(self, clip_index, muted):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            result = clip.SetClipProperty("Mute", muted)
            if not result:
                result = clip.SetProperty("Mute", muted)
            return {"success": bool(result), "muted": muted}
        except Exception as e:
            return {"error": str(e)}

    def add_audio_track(self, name="SFX"):
        if not self.timeline:
            return {"error": "No timeline active"}

        try:
            result = self.timeline.AddTrack("audio")
            track_count = self.timeline.GetTrackCount("audio")
            if result:
                self.timeline.SetTrackName("audio", track_count, name)
            return {"success": bool(result), "track_index": track_count, "name": name}
        except Exception as e:
            return {"error": str(e)}

    def import_audio_to_track(self, track_index, file_path, timeline_position):
        if not self.media_pool or not self.timeline:
            return {"error": "No project/timeline active"}

        try:
            clips = self.media_pool.ImportMedia([file_path])
            if not clips:
                return {"error": f"Failed to import audio: {file_path}"}

            result = self.media_pool.AppendToTimeline([{
                "mediaPoolItem": clips[0],
                "startFrame": 0,
                "recordFrame": timeline_position,
                "trackIndex": track_index,
                "mediaType": 2,  # audio
            }])

            effect_id = generate_effect_id()
            self._register_effect(-1, {
                "id": effect_id,
                "type": "sfx-layer",
                "ingredient_id": "imported_audio",
                "parameters": {
                    "file_path": file_path,
                    "track_index": track_index,
                    "timeline_position": timeline_position,
                },
                "resolve_ref": {"track_index": track_index},
            })

            return {
                "success": bool(result),
                "effect_id": effect_id,
                "track_index": track_index,
                "position": timeline_position,
            }
        except Exception as e:
            return {"error": str(e)}
