"""
Clip properties: opacity, retiming, transform.
"""

from resolve_helpers import get_clip


RETIME_MODE_MAP = {
    "optical_flow": "OpticalFlow",
    "nearest": "NearestFrame",
    "frame_blend": "FrameBlend",
}


class ClipPropsMixin:

    def set_clip_opacity(self, clip_index, opacity):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            clamped = max(0.0, min(1.0, float(opacity)))
            result = clip.SetProperty("Opacity", clamped * 100)
            if not result:
                result = clip.SetClipProperty("Opacity", clamped * 100)
            return {"success": bool(result), "opacity": clamped}
        except Exception as e:
            return {"error": str(e)}

    def set_retiming(self, clip_index, mode, speed):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            applied = {}

            resolve_mode = RETIME_MODE_MAP.get(mode, mode)
            try:
                r = clip.SetProperty("RetimeProcess", resolve_mode)
                applied["retime_mode"] = resolve_mode if r else "not applied"
            except Exception:
                applied["retime_mode"] = "not supported"

            try:
                r = clip.SetClipProperty("Speed", speed)
                applied["speed"] = speed if r else "not applied"
            except Exception:
                try:
                    r = clip.SetProperty("Speed", speed)
                    applied["speed"] = speed if r else "not applied"
                except Exception:
                    applied["speed"] = "not supported"

            return {"success": True, "applied": applied}
        except Exception as e:
            return {"error": str(e)}

    def set_clip_transform(self, clip_index, params):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        prop_map = {
            "zoom": "ZoomX",
            "zoom_x": "ZoomX",
            "zoom_y": "ZoomY",
            "position_x": "PanX",
            "position_y": "PanY",
            "rotation": "RotationAngle",
            "anchor_x": "AnchorPointX",
            "anchor_y": "AnchorPointY",
            "crop_left": "CropLeft",
            "crop_right": "CropRight",
            "crop_top": "CropTop",
            "crop_bottom": "CropBottom",
        }

        try:
            applied = {}
            for key, value in params.items():
                resolve_prop = prop_map.get(key, key)
                try:
                    result = clip.SetProperty(resolve_prop, value)
                    applied[key] = value if result else "not applied"
                except Exception:
                    applied[key] = "not supported"

            if "zoom" in params and "zoom_y" not in params:
                try:
                    clip.SetProperty("ZoomY", params["zoom"])
                except Exception:
                    pass

            return {"success": True, "applied": applied}
        except Exception as e:
            return {"error": str(e)}
