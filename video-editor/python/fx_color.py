"""
Colour page effects: node management, grading parameters, keyframes.
"""

from resolve_helpers import get_clip, generate_effect_id

NODE_TYPE_MAP = {
    "serial": "AddSerialNode",
    "parallel": "AddParallelNode",
    "layer": "AddLayerNode",
}


class ColorFXMixin:

    def apply_cst(self, clip_index, node_index, input_color_space, input_gamma,
                  output_color_space="Rec.709", output_gamma="Gamma 2.4"):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            applied = {}
            cst_props = {
                "ColorSpaceInputGamma": input_gamma,
                "ColorSpaceInputColorSpace": input_color_space,
                "ColorSpaceOutputGamma": output_gamma,
                "ColorSpaceOutputColorSpace": output_color_space,
                "ColorSpaceMode": "Custom",
            }

            for prop, value in cst_props.items():
                try:
                    result = clip.SetProperty(prop, value)
                    applied[prop] = value if result else "not applied"
                except Exception:
                    applied[prop] = "not supported"

            effect_id = generate_effect_id()
            self._register_effect(clip_index, {
                "id": effect_id,
                "type": "cst",
                "ingredient_id": "color_space_transform",
                "parameters": {
                    "input_color_space": input_color_space,
                    "input_gamma": input_gamma,
                    "output_color_space": output_color_space,
                    "output_gamma": output_gamma,
                },
            })

            return {"success": True, "effect_id": effect_id, "applied": applied}
        except Exception as e:
            return {"error": str(e)}

    def add_color_node(self, clip_index, node_type="serial"):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            add_method = NODE_TYPE_MAP.get(node_type, "AddSerialNode")
            method = getattr(clip, add_method, None)

            if method:
                result = method()
            else:
                result = clip.AddSerialNode()

            node_count = clip.GetNumNodes()

            effect_id = generate_effect_id()
            self._register_effect(clip_index, {
                "id": effect_id,
                "type": "color-node",
                "ingredient_id": f"color_node_{node_type}",
                "parameters": {"node_type": node_type},
                "resolve_ref": {"node_index": node_count},
            })

            return {
                "success": bool(result),
                "effect_id": effect_id,
                "node_index": node_count,
                "node_type": node_type,
            }
        except Exception as e:
            return {"error": str(e)}

    def set_node_params(self, clip_index, node_index, params):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            applied = {}

            lift = params.get("lift")
            gamma = params.get("gamma")
            gain = params.get("gain")

            if lift or gamma or gain:
                l = lift if lift else {"r": 0, "g": 0, "b": 0}
                g = gamma if gamma else {"r": 0, "g": 0, "b": 0}
                gn = gain if gain else {"r": 1, "g": 1, "b": 1}
                try:
                    clip.SetNodeLGG(node_index, l, g, gn)
                    applied["lgg"] = True
                except Exception:
                    applied["lgg"] = "not supported"

            simple_props = ["Contrast", "Saturation", "Hue", "MidDetail",
                            "ColorBoost", "HighlightSaturation", "ShadowSaturation",
                            "Temperature", "Tint"]

            for prop_name in simple_props:
                key = prop_name.lower()
                if key in params:
                    try:
                        result = clip.SetProperty(prop_name, params[key])
                        applied[key] = params[key] if result else "not applied"
                    except Exception:
                        applied[key] = "not supported"

            return {"success": True, "applied": applied, "node_index": node_index}
        except Exception as e:
            return {"error": str(e)}

    def set_keyframe(self, clip_index, node_index, param, frame, value):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            try:
                result = clip.SetNodeProperty(node_index, param, value, frame)
                if result:
                    return {"success": True, "node_index": node_index,
                            "param": param, "frame": frame, "value": value}
            except Exception:
                pass

            clip.AddMarker(
                frame, "Yellow", f"Keyframe: {param}",
                f"Set {param} to {value} at frame {frame} on node {node_index}", 1
            )
            return {
                "success": False,
                "fallback": "marker_placed",
                "note": f"Colour keyframe API not available. Marker placed at frame {frame}.",
            }
        except Exception as e:
            return {"error": str(e)}
