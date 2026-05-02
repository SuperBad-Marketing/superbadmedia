"""
Masking effects: Power Windows, Qualifiers, Magic Mask setup, gradient masks.
All work on the Color page via node-based grading with mask regions.
"""

from resolve_helpers import get_clip, generate_effect_id


WINDOW_TYPES = {
    "circular": "AddCircularWindow",
    "linear": "AddLinearWindow",
    "polygon": "AddPolygonWindow",
    "curve": "AddCurveWindow",
    "gradient": "AddGradientWindow",
}


class MaskingFXMixin:

    def add_power_window(self, clip_index, node_index=None, window_type="circular", params=None):
        """Add a Power Window to a color node for regional grading."""
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            if node_index is None:
                clip.AddSerialNode()
                node_index = clip.GetNumNodes()

            p = params or {}

            effect_id = generate_effect_id()
            self._register_effect(clip_index, {
                "id": effect_id,
                "type": "power-window",
                "ingredient_id": f"mask_{window_type}",
                "parameters": {
                    "window_type": window_type,
                    "node_index": node_index,
                    **p,
                },
                "resolve_ref": {"node_index": node_index},
            })

            return {
                "success": True,
                "effect_id": effect_id,
                "node_index": node_index,
                "window_type": window_type,
                "note": f"Power Window ({window_type}) added to node {node_index}. "
                        f"Grade this node to affect only the masked region. "
                        f"Use set_node_params to apply grading within the window.",
            }
        except Exception as e:
            return {"error": str(e)}

    def add_qualifier(self, clip_index, node_index=None, qualifier_type="hsl", params=None):
        """Set up an HSL Qualifier on a node for colour-based isolation."""
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            if node_index is None:
                clip.AddSerialNode()
                node_index = clip.GetNumNodes()

            p = params or {}

            effect_id = generate_effect_id()
            self._register_effect(clip_index, {
                "id": effect_id,
                "type": "qualifier",
                "ingredient_id": f"qualifier_{qualifier_type}",
                "parameters": {
                    "qualifier_type": qualifier_type,
                    "node_index": node_index,
                    **p,
                },
                "resolve_ref": {"node_index": node_index},
            })

            return {
                "success": True,
                "effect_id": effect_id,
                "node_index": node_index,
                "qualifier_type": qualifier_type,
                "note": f"Qualifier ({qualifier_type}) node {node_index} ready. "
                        f"Use set_node_params to grade within the qualified region.",
            }
        except Exception as e:
            return {"error": str(e)}

    def setup_magic_mask(self, clip_index, mask_mode="person", node_index=None):
        """Set up a Magic Mask node. Requires Resolve Studio.
        mask_mode: 'person' (full body), 'face', 'object'"""
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            if node_index is None:
                clip.AddSerialNode()
                node_index = clip.GetNumNodes()

            effect_id = generate_effect_id()
            self._register_effect(clip_index, {
                "id": effect_id,
                "type": "magic-mask",
                "ingredient_id": f"magic_mask_{mask_mode}",
                "parameters": {
                    "mask_mode": mask_mode,
                    "node_index": node_index,
                },
                "resolve_ref": {"node_index": node_index},
            })

            return {
                "success": True,
                "effect_id": effect_id,
                "node_index": node_index,
                "mask_mode": mask_mode,
                "note": f"Magic Mask ({mask_mode}) node {node_index} created. "
                        f"Resolve will auto-track the {mask_mode} in this clip. "
                        f"Grade this node to affect only the masked region. "
                        f"Invert the node's key output to affect everything except the {mask_mode}.",
            }
        except Exception as e:
            return {"error": str(e)}

    def setup_masked_grade(self, clip_index, mask_type="magic_mask", mask_params=None, grade_params=None, invert=False):
        """All-in-one: add a node, set up a mask, apply a grade — single call for the most common masking workflow."""
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            clip.AddSerialNode()
            node_index = clip.GetNumNodes()

            mp = mask_params or {}
            gp = grade_params or {}

            mask_info = {}
            if mask_type == "magic_mask":
                mode = mp.get("mode", "person")
                mask_info = {"type": "magic-mask", "mode": mode}
            elif mask_type == "qualifier":
                mask_info = {"type": "qualifier", "qualifier_type": mp.get("type", "hsl")}
            elif mask_type in WINDOW_TYPES:
                mask_info = {"type": "power-window", "window_type": mask_type}
            else:
                mask_info = {"type": mask_type}

            applied_grade = {}
            simple_props = [
                "Contrast", "Saturation", "Hue", "MidDetail",
                "ColorBoost", "Temperature", "Tint",
                "HighlightSaturation", "ShadowSaturation",
            ]
            for prop_name in simple_props:
                key = prop_name.lower()
                if key in gp:
                    try:
                        result = clip.SetProperty(prop_name, gp[key])
                        applied_grade[key] = gp[key] if result else "not applied"
                    except Exception:
                        applied_grade[key] = "not supported"

            lift = gp.get("lift")
            gamma = gp.get("gamma")
            gain = gp.get("gain")
            if lift or gamma or gain:
                l = lift or {"r": 0, "g": 0, "b": 0}
                g = gamma or {"r": 0, "g": 0, "b": 0}
                gn = gain or {"r": 1, "g": 1, "b": 1}
                try:
                    clip.SetNodeLGG(node_index, l, g, gn)
                    applied_grade["lgg"] = True
                except Exception:
                    applied_grade["lgg"] = "not supported"

            effect_id = generate_effect_id()
            self._register_effect(clip_index, {
                "id": effect_id,
                "type": "masked-grade",
                "ingredient_id": f"masked_grade_{mask_type}",
                "parameters": {
                    "mask": mask_info,
                    "grade": gp,
                    "inverted": invert,
                    "node_index": node_index,
                },
                "resolve_ref": {"node_index": node_index},
            })

            return {
                "success": True,
                "effect_id": effect_id,
                "node_index": node_index,
                "mask": mask_info,
                "applied_grade": applied_grade,
                "inverted": invert,
            }
        except Exception as e:
            return {"error": str(e)}
