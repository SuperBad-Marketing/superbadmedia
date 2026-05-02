"""
Timeline operations: adjustment layers, composite modes, duplication, markers, razor, speed curves.
"""

from resolve_helpers import get_clip, generate_effect_id

MARKER_COLORS = [
    "Blue", "Cyan", "Green", "Yellow", "Red", "Pink", "Purple",
    "Fuchsia", "Rose", "Lavender", "Sky", "Mint", "Lemon",
    "Sand", "Cocoa", "Cream",
]


class TimelineOpsMixin:

    def add_adjustment_layer(self, start_frame, end_frame):
        if not self.timeline or not self.media_pool:
            return {"error": "No timeline active"}

        try:
            duration = end_frame - start_frame
            video_track_count = self.timeline.GetTrackCount("video")
            target_track = video_track_count + 1
            self.timeline.AddTrack("video")

            result = self.media_pool.AppendToTimeline([{
                "mediaType": 1,
                "startFrame": start_frame,
                "endFrame": end_frame,
                "trackIndex": target_track,
            }])

            if not result:
                self.timeline.AddMarker(
                    start_frame, "Yellow", "Adjustment Layer",
                    f"Add adjustment layer from frame {start_frame} to {end_frame}", duration
                )
                return {
                    "success": False,
                    "fallback": "marker_placed",
                    "note": "Adjustment layer API not available. Marker placed.",
                }

            return {
                "success": True,
                "track_index": target_track,
                "start_frame": start_frame,
                "end_frame": end_frame,
            }
        except Exception as e:
            return {"error": str(e)}

    def set_composite_mode(self, clip_index, mode):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            result = clip.SetProperty("CompositeMode", mode)
            if not result:
                result = clip.SetClipProperty("CompositeMode", mode)
            return {"success": bool(result), "mode": mode}
        except Exception as e:
            return {"error": str(e)}

    def duplicate_to_track(self, clip_index, target_track):
        if not self.timeline or not self.media_pool:
            return {"error": "No timeline active"}

        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            media_pool_item = clip.GetMediaPoolItem()
            if not media_pool_item:
                return {"error": "Could not get media pool item for clip"}

            clip_start = clip.GetStart()
            clip_end = clip.GetEnd()

            video_track_count = self.timeline.GetTrackCount("video")
            while target_track > video_track_count:
                self.timeline.AddTrack("video")
                video_track_count += 1

            result = self.media_pool.AppendToTimeline([{
                "mediaPoolItem": media_pool_item,
                "startFrame": clip.GetLeftOffset(),
                "endFrame": clip.GetLeftOffset() + (clip_end - clip_start),
                "recordFrame": clip_start,
                "trackIndex": target_track,
                "mediaType": 1,
            }])

            return {
                "success": bool(result),
                "source_clip": clip_index,
                "target_track": target_track,
            }
        except Exception as e:
            return {"error": str(e)}

    def add_marker(self, clip_index, frame, color="Blue", name="", note=""):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        if color not in MARKER_COLORS:
            color = "Blue"

        try:
            result = clip.AddMarker(frame, color, name, note, 1)
            return {"success": bool(result), "frame": frame, "color": color, "name": name}
        except Exception as e:
            return {"error": str(e)}

    def razor_at(self, clip_index, frame):
        if not self.timeline:
            return {"error": "No timeline active"}

        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            clip_start = clip.GetStart()
            abs_frame = clip_start + frame

            try:
                result = self.timeline.SplitClipAtFrame(abs_frame)
                if result:
                    return {"success": True, "frame": abs_frame}
            except Exception:
                pass

            clip.AddMarker(frame, "Red", "Split", f"Split clip at frame {frame}", 1)
            return {
                "success": False,
                "fallback": "marker_placed",
                "note": f"Razor API not available. Marker placed at frame {frame}.",
            }
        except Exception as e:
            return {"error": str(e)}

    def set_speed_curve(self, clip_index, keyframes):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            try:
                retime_supported = hasattr(clip, "SetRetimeKeyframe")
                if retime_supported:
                    for kf in keyframes:
                        clip.SetRetimeKeyframe(kf["frame"], kf["speed"])
                    return {"success": True, "keyframes": len(keyframes)}
            except Exception:
                pass

            if len(keyframes) == 1:
                speed = keyframes[0].get("speed", 100)
                result = clip.SetClipProperty("Speed", speed)
                if result:
                    return {"success": True, "uniform_speed": speed}

            for kf in keyframes:
                clip.AddMarker(
                    kf["frame"], "Purple", "Speed",
                    f"Set speed to {kf['speed']}% at this point", 1
                )

            return {
                "success": False,
                "fallback": "markers_placed",
                "note": f"Speed curve API not available. {len(keyframes)} markers placed.",
            }
        except Exception as e:
            return {"error": str(e)}
