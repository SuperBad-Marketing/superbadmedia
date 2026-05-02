"""
Visual effects: ResolveFX, Fusion comp injection, compound Fusion, Fusion param updates.
"""

from resolve_helpers import get_clip, generate_effect_id


class VisualFXMixin:

    def apply_resolve_fx(self, clip_index, effect_name, parameters=None):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            added = clip.AddResolveFXToClip(effect_name)
            if not added:
                return {"error": f"Could not add ResolveFX '{effect_name}'"}

            if parameters:
                for param, value in parameters.items():
                    try:
                        clip.SetResolveFXProperty(effect_name, param, value)
                    except Exception:
                        pass

            effect_id = generate_effect_id()
            self._register_effect(clip_index, {
                "id": effect_id,
                "type": "resolve-fx",
                "ingredient_id": effect_name,
                "parameters": parameters or {},
                "resolve_ref": {"effect_name": effect_name},
            })

            return {"success": True, "effect_id": effect_id, "effect_name": effect_name}
        except Exception as e:
            return {"error": str(e)}

    def inject_fusion_comp(self, clip_index, fusion_script):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            comp = clip.GetFusionCompByIndex(0)
            if not comp:
                clip.AddFusionComp()
                comp = clip.GetFusionCompByIndex(0)

            if not comp:
                return {"error": "Could not create Fusion composition"}

            if fusion_script:
                comp.Execute(fusion_script)

            effect_id = generate_effect_id()
            self._register_effect(clip_index, {
                "id": effect_id,
                "type": "fusion",
                "ingredient_id": "custom_fusion",
                "parameters": {},
                "resolve_ref": {"comp_index": 0},
            })

            return {"success": True, "effect_id": effect_id}
        except Exception as e:
            return {"error": str(e)}

    def build_compound_fusion(self, clip_index, ingredients):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            comp = clip.GetFusionCompByIndex(0)
            if not comp:
                clip.AddFusionComp()
                comp = clip.GetFusionCompByIndex(0)

            if not comp:
                return {"error": "Could not create Fusion composition"}

            effect_ids = []
            for ingredient in ingredients:
                script = ingredient.get("fusion_script", "")
                if script:
                    comp.Execute(script)

                effect_id = generate_effect_id()
                self._register_effect(clip_index, {
                    "id": effect_id,
                    "type": "fusion",
                    "ingredient_id": ingredient.get("id", "unknown"),
                    "variant": ingredient.get("variant", "standard"),
                    "parameters": ingredient.get("params", {}),
                    "resolve_ref": {
                        "comp_index": 0,
                        "tool_name": ingredient.get("tool_name", ingredient.get("id", "")),
                    },
                })
                effect_ids.append(effect_id)

            tools = comp.GetToolList() if comp else {}
            return {
                "success": True,
                "effect_ids": effect_ids,
                "tool_count": len(tools) if tools else 0,
            }
        except Exception as e:
            return {"error": str(e)}

    def set_fusion_param(self, clip_index, tool_name, param, value):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            comp = clip.GetFusionCompByIndex(0)
            if not comp:
                return {"error": "No Fusion composition on this clip"}

            tools = comp.GetToolList()
            target = None
            for tool in (tools.values() if isinstance(tools, dict) else tools):
                if tool.Name == tool_name or tool.ID == tool_name:
                    target = tool
                    break

            if not target:
                return {"error": f"Tool '{tool_name}' not found in Fusion comp"}

            target.SetInput(param, value)
            return {"success": True, "tool": tool_name, "param": param, "value": value}
        except Exception as e:
            return {"error": str(e)}
