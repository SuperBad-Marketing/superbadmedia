"""
Effect management: query state, remove, update, bypass, render stills, reorder.
Provides the backend for the Applied Effects UI panel.
"""

import os

from resolve_helpers import get_clip, generate_effect_id, TEMP_STILLS_DIR, ensure_temp_dirs


class EffectsMgmtMixin:

    def get_clip_effects_state(self, clip_index):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        state = {
            "clip_index": clip_index,
            "color_nodes": [],
            "fusion_tools": [],
            "resolve_fx": [],
            "speed": 100,
            "retime_mode": "NearestFrame",
            "transform": {},
            "audio_volume": 0,
            "audio_muted": False,
            "audio_pan": 0,
            "registered_effects": [],
        }

        try:
            # Colour nodes
            try:
                node_count = clip.GetNumNodes()
                if node_count:
                    for i in range(1, node_count + 1):
                        node_info = {"index": i, "params": {}}
                        try:
                            lgg = clip.GetNodeLGG(i)
                            if lgg:
                                node_info["params"]["lgg"] = lgg
                        except Exception:
                            pass
                        state["color_nodes"].append(node_info)
            except Exception:
                pass

            # Fusion comp
            try:
                comp = clip.GetFusionCompByIndex(0)
                if comp:
                    tools = comp.GetToolList()
                    if tools:
                        tool_list = tools.values() if isinstance(tools, dict) else tools
                        for tool in tool_list:
                            try:
                                tool_info = {
                                    "name": tool.Name if hasattr(tool, "Name") else str(tool),
                                    "type": tool.ID if hasattr(tool, "ID") else "unknown",
                                }
                                state["fusion_tools"].append(tool_info)
                            except Exception:
                                pass
            except Exception:
                pass

            # Speed / retiming
            try:
                speed = clip.GetProperty("Speed")
                if speed is not None:
                    state["speed"] = speed
            except Exception:
                pass
            try:
                retime = clip.GetProperty("RetimeProcess")
                if retime is not None:
                    state["retime_mode"] = retime
            except Exception:
                pass

            # Transform
            transform_props = ["ZoomX", "ZoomY", "PanX", "PanY",
                               "RotationAngle", "CropLeft", "CropRight",
                               "CropTop", "CropBottom"]
            for prop in transform_props:
                try:
                    val = clip.GetProperty(prop)
                    if val is not None:
                        state["transform"][prop] = val
                except Exception:
                    pass

            # Audio
            for audio_prop, key in [("Volume", "audio_volume"),
                                     ("Mute", "audio_muted"),
                                     ("Pan", "audio_pan")]:
                try:
                    val = clip.GetProperty(audio_prop)
                    if val is not None:
                        state[key] = val
                except Exception:
                    pass

            # Merge with effects registry
            registry_key = clip_index
            registered = self._effects_registry.get(registry_key, [])
            state["registered_effects"] = [
                {
                    "id": e["id"],
                    "ingredient_id": e.get("ingredient_id", ""),
                    "variant": e.get("variant", ""),
                    "type": e["type"],
                    "bypassed": e.get("bypassed", False),
                    "parameters": e.get("parameters", {}),
                }
                for e in registered
            ]

            return state
        except Exception as e:
            return {"error": str(e)}

    def remove_effect(self, clip_index, effect_id):
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        registry_key = clip_index
        effects = self._effects_registry.get(registry_key, [])
        target = None
        for e in effects:
            if e["id"] == effect_id:
                target = e
                break

        if not target:
            return {"error": f"Effect {effect_id} not found in registry"}

        try:
            effect_type = target["type"]
            ref = target.get("resolve_ref", {})

            if effect_type == "color-node":
                node_idx = ref.get("node_index")
                if node_idx:
                    try:
                        clip.DeleteNode(node_idx)
                    except Exception:
                        pass

            elif effect_type == "fusion":
                comp = clip.GetFusionCompByIndex(0)
                if comp:
                    tool_name = ref.get("tool_name")
                    if tool_name:
                        tools = comp.GetToolList()
                        tool_list = tools.values() if isinstance(tools, dict) else tools
                        for tool in tool_list:
                            if (hasattr(tool, "Name") and tool.Name == tool_name) or \
                               (hasattr(tool, "ID") and tool.ID == tool_name):
                                try:
                                    tool.Delete()
                                except Exception:
                                    pass
                                break

            elif effect_type == "resolve-fx":
                effect_name = ref.get("effect_name")
                if effect_name:
                    try:
                        clip.RemoveResolveFXFromClip(effect_name)
                    except Exception:
                        pass

            elif effect_type == "audio-preprocess":
                try:
                    self.mute_clip_audio(clip_index, False)
                except Exception:
                    pass

            self._unregister_effect(clip_index, effect_id)
            return {"success": True, "removed": effect_id}
        except Exception as e:
            return {"error": str(e)}

    def update_effect_param(self, clip_index, effect_id, param, value):
        registry_key = clip_index
        effects = self._effects_registry.get(registry_key, [])
        target = None
        for e in effects:
            if e["id"] == effect_id:
                target = e
                break

        if not target:
            return {"error": f"Effect {effect_id} not found in registry"}

        effect_type = target["type"]
        ref = target.get("resolve_ref", {})

        try:
            if effect_type == "color-node":
                node_idx = ref.get("node_index")
                if node_idx:
                    return self.set_node_params(clip_index, node_idx, {param: value})

            elif effect_type == "fusion":
                tool_name = ref.get("tool_name")
                if tool_name:
                    return self.set_fusion_param(clip_index, tool_name, param, value)

            elif effect_type == "resolve-fx":
                clip, err = get_clip(self.timeline, clip_index)
                if err:
                    return err
                effect_name = ref.get("effect_name")
                try:
                    clip.SetResolveFXProperty(effect_name, param, value)
                    target["parameters"][param] = value
                    return {"success": True, "param": param, "value": value}
                except Exception as e:
                    return {"error": str(e)}

            target["parameters"][param] = value
            return {"success": True, "param": param, "value": value}
        except Exception as e:
            return {"error": str(e)}

    def bypass_effect(self, clip_index, effect_id, bypassed):
        registry_key = clip_index
        effects = self._effects_registry.get(registry_key, [])
        target = None
        for e in effects:
            if e["id"] == effect_id:
                target = e
                break

        if not target:
            return {"error": f"Effect {effect_id} not found in registry"}

        effect_type = target["type"]
        ref = target.get("resolve_ref", {})

        try:
            clip, err = get_clip(self.timeline, clip_index)
            if err:
                return err

            if effect_type == "color-node":
                node_idx = ref.get("node_index")
                if node_idx:
                    try:
                        clip.SetNodeEnabled(node_idx, not bypassed)
                    except Exception:
                        pass

            elif effect_type == "fusion":
                comp = clip.GetFusionCompByIndex(0)
                if comp:
                    tool_name = ref.get("tool_name")
                    if tool_name:
                        tools = comp.GetToolList()
                        tool_list = tools.values() if isinstance(tools, dict) else tools
                        for tool in tool_list:
                            if hasattr(tool, "Name") and tool.Name == tool_name:
                                try:
                                    tool.SetAttrs({"TOOLB_PassThrough": bypassed})
                                except Exception:
                                    pass
                                break

            target["bypassed"] = bypassed
            return {"success": True, "effect_id": effect_id, "bypassed": bypassed}
        except Exception as e:
            return {"error": str(e)}

    def render_still(self, clip_index, frame, effects_mask=None):
        if not self.timeline:
            return {"error": "No timeline active"}

        ensure_temp_dirs()

        try:
            bypassed_effects = []
            if effects_mask:
                for eid in effects_mask:
                    result = self.bypass_effect(clip_index, eid, True)
                    if result.get("success"):
                        bypassed_effects.append(eid)

            clip, err = get_clip(self.timeline, clip_index)
            if err:
                if bypassed_effects:
                    for eid in bypassed_effects:
                        self.bypass_effect(clip_index, eid, False)
                return err

            clip_start = clip.GetStart()
            abs_frame = clip_start + frame
            self.timeline.SetCurrentTimecode(str(abs_frame))

            still_id = generate_effect_id()
            still_path = os.path.join(TEMP_STILLS_DIR, f"{still_id}.png")

            try:
                gallery = self.project.GetGallery()
                if gallery:
                    album = gallery.GetCurrentStillAlbum()
                    if album:
                        still = self.timeline.GrabStill()
                        if still:
                            album.ExportStills([still], TEMP_STILLS_DIR, still_id, "png")
            except Exception:
                pass

            if bypassed_effects:
                for eid in bypassed_effects:
                    self.bypass_effect(clip_index, eid, False)

            if os.path.isfile(still_path):
                return {"success": True, "still_path": still_path}

            return {
                "success": False,
                "fallback": "api_limited",
                "note": "Still grab API not fully available. Use Resolve's viewer for preview.",
            }
        except Exception as e:
            return {"error": str(e)}

    def reorder_effects(self, clip_index, effect_ids):
        registry_key = clip_index
        effects = self._effects_registry.get(registry_key, [])

        id_to_effect = {e["id"]: e for e in effects}
        reordered = []
        for eid in effect_ids:
            if eid in id_to_effect:
                reordered.append(id_to_effect[eid])

        for e in effects:
            if e["id"] not in effect_ids:
                reordered.append(e)

        self._effects_registry[registry_key] = reordered

        color_nodes = [e for e in reordered if e["type"] == "color-node"]
        if len(color_nodes) > 1:
            clip, err = get_clip(self.timeline, clip_index)
            if not err and clip:
                clip.AddMarker(
                    0, "Yellow", "Reorder",
                    "Colour node order changed — manual reorder may be needed in Color page", 1
                )

        return {
            "success": True,
            "order": [e["id"] for e in reordered],
        }
