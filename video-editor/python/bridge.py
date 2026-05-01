#!/usr/bin/env python3
"""
SuperEdits — DaVinci Resolve Bridge
Connects to Resolve's scripting API and executes commands.
Run alongside the SuperEdits app when editing.
"""

import sys
import json
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from resolve_helpers import check_ffmpeg, check_sox, ensure_temp_dirs
from fx_visual import VisualFXMixin
from fx_color import ColorFXMixin
from fx_audio import AudioFXMixin
from fx_audio_preprocess import AudioPreprocessMixin
from fx_timeline import TimelineOpsMixin
from fx_clip import ClipPropsMixin
from fx_effects_mgmt import EffectsMgmtMixin
from fx_masking import MaskingFXMixin


def get_resolve():
    try:
        import resolve_loader
        script_module = resolve_loader.load()
        if not script_module:
            return None
        resolve = script_module.scriptapp("Resolve")
        return resolve
    except Exception:
        return None


class ResolveBridge(
    VisualFXMixin,
    ColorFXMixin,
    AudioFXMixin,
    AudioPreprocessMixin,
    TimelineOpsMixin,
    ClipPropsMixin,
    EffectsMgmtMixin,
    MaskingFXMixin,
):
    def __init__(self):
        self.resolve = None
        self.project_manager = None
        self.project = None
        self.media_pool = None
        self.timeline = None
        self._effects_registry = {}

    def _register_effect(self, clip_index, effect_data):
        effect_data.setdefault("applied_at", datetime.now(timezone.utc).isoformat())
        effect_data.setdefault("bypassed", False)
        self._effects_registry.setdefault(clip_index, []).append(effect_data)

    def _unregister_effect(self, clip_index, effect_id):
        effects = self._effects_registry.get(clip_index, [])
        self._effects_registry[clip_index] = [e for e in effects if e["id"] != effect_id]

    def connect(self):
        self.resolve = get_resolve()
        if not self.resolve:
            return {"connected": False, "error": "Could not connect to DaVinci Resolve. Make sure it is running."}

        self.project_manager = self.resolve.GetProjectManager()
        self.project = self.project_manager.GetCurrentProject()
        if self.project:
            self.media_pool = self.project.GetMediaPool()
            self.timeline = self.project.GetCurrentTimeline()

        return {
            "connected": True,
            "version": self.resolve.GetVersionString() if hasattr(self.resolve, 'GetVersionString') else "unknown",
            "project": self.project.GetName() if self.project else None,
            "timeline": self.timeline.GetName() if self.timeline else None,
            "ffmpeg": check_ffmpeg(),
            "sox": check_sox(),
        }

    def get_status(self):
        if not self.resolve:
            return {"connected": False}
        try:
            pm = self.resolve.GetProjectManager()
            proj = pm.GetCurrentProject()
            return {
                "connected": True,
                "project": proj.GetName() if proj else None,
                "timeline": proj.GetCurrentTimeline().GetName() if proj and proj.GetCurrentTimeline() else None,
            }
        except Exception:
            self.resolve = None
            return {"connected": False}

    def list_projects(self):
        if not self.resolve:
            return {"error": "Not connected to Resolve"}
        pm = self.resolve.GetProjectManager()
        projects = pm.GetProjectListInCurrentFolder()
        return {"projects": projects if projects else []}

    def load_project(self, name):
        if not self.resolve:
            return {"error": "Not connected to Resolve"}
        pm = self.resolve.GetProjectManager()

        current = pm.GetCurrentProject()
        if current and current.GetName() == name:
            self.project = current
            self.media_pool = current.GetMediaPool()
            self.timeline = current.GetCurrentTimeline()
            return {
                "success": True,
                "name": name,
                "timeline": self.timeline.GetName() if self.timeline else None,
            }

        if current:
            pm.SaveProject()
            pm.CloseProject(current)

        project = pm.LoadProject(name)
        if not project:
            return {"error": f"Could not open project '{name}'. Check the name matches exactly."}

        self.project = project
        self.media_pool = project.GetMediaPool()
        self.timeline = project.GetCurrentTimeline()
        self._effects_registry = {}
        return {
            "success": True,
            "name": name,
            "timeline": self.timeline.GetName() if self.timeline else None,
        }

    def close_project(self):
        if not self.resolve:
            return {"error": "Not connected to Resolve"}
        pm = self.resolve.GetProjectManager()
        current = pm.GetCurrentProject()
        if current:
            pm.SaveProject()
            pm.CloseProject(current)
        self.project = None
        self.media_pool = None
        self.timeline = None
        self._effects_registry = {}
        return {"success": True}

    def create_project(self, name, frame_rate=24, width=1920, height=1080):
        if not self.resolve:
            return {"error": "Not connected to Resolve"}

        pm = self.resolve.GetProjectManager()
        project = pm.CreateProject(name)
        if not project:
            return {"error": f"Could not create project '{name}'"}

        project.SetSetting("timelineFrameRate", str(frame_rate))
        project.SetSetting("timelineResolutionWidth", str(width))
        project.SetSetting("timelineResolutionHeight", str(height))

        self.project = project
        self.media_pool = project.GetMediaPool()

        return {"success": True, "name": name}

    def import_media(self, file_paths):
        if not self.media_pool:
            return {"error": "No project open"}

        clips = self.media_pool.ImportMedia(file_paths)
        if not clips:
            return {"error": "Failed to import media", "imported": 0}

        return {"success": True, "imported": len(clips)}

    def create_timeline(self, name, clips=None):
        if not self.media_pool:
            return {"error": "No project open"}

        if clips:
            timeline = self.media_pool.CreateTimelineFromClips(name, clips)
        else:
            timeline = self.media_pool.CreateEmptyTimeline(name)

        if not timeline:
            return {"error": f"Could not create timeline '{name}'"}

        self.timeline = timeline
        return {"success": True, "name": name}

    def add_clips_to_timeline(self, clip_indices):
        if not self.timeline or not self.media_pool:
            return {"error": "No timeline active"}

        root_folder = self.media_pool.GetRootFolder()
        all_clips = root_folder.GetClipList()

        clips_to_add = []
        for idx in clip_indices:
            if 0 <= idx < len(all_clips):
                clips_to_add.append(all_clips[idx])

        if clips_to_add:
            self.media_pool.AppendToTimeline(clips_to_add)
            return {"success": True, "added": len(clips_to_add)}

        return {"error": "No valid clips to add"}

    def add_clips_with_timing(self, clips):
        if not self.timeline or not self.media_pool:
            return {"error": "No timeline active"}

        root_folder = self.media_pool.GetRootFolder()
        all_pool_clips = root_folder.GetClipList()

        path_to_clip = {}
        for c in all_pool_clips:
            fp = c.GetClipProperty("File Path")
            if fp:
                path_to_clip[fp] = c

        added = 0
        for clip_data in clips:
            pool_clip = path_to_clip.get(clip_data.get("filePath"))
            if not pool_clip:
                continue

            fps = float(self.project.GetSetting("timelineFrameRate") or 24)
            start_frame = int(clip_data.get("startTime", 0) * fps)
            end_frame = int(clip_data.get("endTime", 0) * fps)

            self.media_pool.AppendToTimeline([{
                "mediaPoolItem": pool_clip,
                "startFrame": start_frame,
                "endFrame": end_frame,
            }])
            added += 1

        return {"success": True, "added": added}

    def get_timeline_clips(self):
        if not self.timeline:
            return {"error": "No timeline active"}

        clips = []
        track_count = self.timeline.GetTrackCount("video")

        for track_idx in range(1, track_count + 1):
            track_clips = self.timeline.GetItemListInTrack("video", track_idx)
            if track_clips:
                for clip in track_clips:
                    clips.append({
                        "name": clip.GetName(),
                        "start": clip.GetStart(),
                        "end": clip.GetEnd(),
                        "duration": clip.GetDuration(),
                        "track": track_idx,
                    })

        return {"clips": clips}

    def set_clip_color_grade(self, clip_index, grade_params):
        if not self.timeline:
            return {"error": "No timeline active"}

        from resolve_helpers import get_clip
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        applied = {}
        for param, value in grade_params.items():
            try:
                result = clip.SetProperty(param, value)
                applied[param] = value if result else "not applied"
            except Exception as e:
                applied[param] = f"failed: {str(e)}"

        return {"success": True, "applied": applied}

    def apply_lut(self, clip_index, lut_path):
        if not self.timeline:
            return {"error": "No timeline active"}

        from resolve_helpers import get_clip
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            node_count = clip.GetNumNodes()
            result = clip.SetLUT(node_count, lut_path)
            return {"success": bool(result), "lut_path": lut_path, "node": node_count}
        except Exception as e:
            return {"error": str(e)}

    def add_transition(self, clip_index, transition_type="Cross Dissolve", duration=1.0):
        if not self.timeline:
            return {"error": "No timeline active"}

        from resolve_helpers import get_clip
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            result = clip.AddTransition("End", transition_type, duration)
            return {"success": bool(result), "transition": transition_type, "duration": duration}
        except Exception as e:
            return {"error": f"Failed to add transition: {str(e)}"}

    def set_clip_speed(self, clip_index, speed_percent):
        if not self.timeline:
            return {"error": "No timeline active"}

        from resolve_helpers import get_clip
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            result = clip.SetClipProperty("Speed", speed_percent)
            return {"success": bool(result), "speed": speed_percent}
        except Exception as e:
            return {"error": str(e)}

    def add_fusion_comp(self, clip_index, fusion_script=""):
        if not self.timeline:
            return {"error": "No timeline active"}

        from resolve_helpers import get_clip
        clip, err = get_clip(self.timeline, clip_index)
        if err:
            return err

        try:
            fusion_comp = clip.GetFusionCompByIndex(0)
            if not fusion_comp:
                clip.AddFusionComp()
                fusion_comp = clip.GetFusionCompByIndex(0)
            return {"success": True, "has_comp": fusion_comp is not None}
        except Exception as e:
            return {"error": str(e)}

    def render(self, output_path, width=1920, height=1080, codec="H.264", quality="High"):
        if not self.project:
            return {"error": "No project open"}

        target_dir = os.path.dirname(output_path) or output_path
        filename = os.path.basename(output_path) if '.' in os.path.basename(output_path) else None

        settings = {
            "TargetDir": target_dir,
            "FormatWidth": width,
            "FormatHeight": height,
        }
        if filename:
            settings["CustomName"] = os.path.splitext(filename)[0]

        self.project.SetRenderSettings(settings)
        self.project.AddRenderJob()
        self.project.StartRendering()

        return {"success": True, "output": output_path}

    def get_render_status(self):
        if not self.project:
            return {"error": "No project open"}

        is_rendering = self.project.IsRenderingInProgress()
        progress = self.project.GetRenderJobStatus(0) if is_rendering else None

        return {
            "rendering": is_rendering,
            "progress": progress,
        }


def handle_command(bridge, command):
    action = command.get("action")
    params = command.get("params", {})

    actions = {
        # Core
        "connect": lambda: bridge.connect(),
        "status": lambda: bridge.get_status(),
        "create_project": lambda: bridge.create_project(**params),
        "import_media": lambda: bridge.import_media(params.get("file_paths", [])),
        "create_timeline": lambda: bridge.create_timeline(params.get("name", "Timeline 1")),
        "add_clips": lambda: bridge.add_clips_to_timeline(params.get("clip_indices", [])),
        "add_clips_with_timing": lambda: bridge.add_clips_with_timing(params.get("clips", [])),
        "get_timeline_clips": lambda: bridge.get_timeline_clips(),
        "set_grade": lambda: bridge.set_clip_color_grade(params.get("clip_index", 0), params.get("grade_params", {})),
        "apply_lut": lambda: bridge.apply_lut(params.get("clip_index", 0), params.get("lut_path", "")),
        "add_transition": lambda: bridge.add_transition(params.get("clip_index", 0), params.get("transition_type", "Cross Dissolve"), params.get("duration", 1.0)),
        "set_clip_speed": lambda: bridge.set_clip_speed(params.get("clip_index", 0), params.get("speed_percent", 100)),
        "add_fusion_comp": lambda: bridge.add_fusion_comp(params.get("clip_index", 0), params.get("fusion_script", "")),
        "render": lambda: bridge.render(**params),
        "render_status": lambda: bridge.get_render_status(),

        # Project management
        "list_projects": lambda: bridge.list_projects(),
        "load_project": lambda: bridge.load_project(params.get("name", "")),
        "close_project": lambda: bridge.close_project(),

        # Visual effects
        "apply_resolve_fx": lambda: bridge.apply_resolve_fx(params.get("clip_index", 0), params.get("effect_name", ""), params.get("parameters")),
        "inject_fusion_comp": lambda: bridge.inject_fusion_comp(params.get("clip_index", 0), params.get("fusion_script", "")),
        "build_compound_fusion": lambda: bridge.build_compound_fusion(params.get("clip_index", 0), params.get("ingredients", [])),
        "set_fusion_param": lambda: bridge.set_fusion_param(params.get("clip_index", 0), params.get("tool_name", ""), params.get("param", ""), params.get("value")),

        # Colour
        "apply_cst": lambda: bridge.apply_cst(params.get("clip_index", 0), params.get("node_index", 1), params.get("input_color_space", ""), params.get("input_gamma", ""), params.get("output_color_space", "Rec.709"), params.get("output_gamma", "Gamma 2.4")),
        "add_color_node": lambda: bridge.add_color_node(params.get("clip_index", 0), params.get("node_type", "serial")),
        "set_node_params": lambda: bridge.set_node_params(params.get("clip_index", 0), params.get("node_index", 1), params.get("params", {})),
        "set_keyframe": lambda: bridge.set_keyframe(params.get("clip_index", 0), params.get("node_index", 1), params.get("param", ""), params.get("frame", 0), params.get("value", 0)),

        # Audio — Tier A
        "set_clip_volume": lambda: bridge.set_clip_volume(params.get("clip_index", 0), params.get("volume_db", 0)),
        "set_volume_keyframe": lambda: bridge.set_volume_keyframe(params.get("clip_index", 0), params.get("frame", 0), params.get("volume_db", 0)),
        "set_clip_pan": lambda: bridge.set_clip_pan(params.get("clip_index", 0), params.get("pan", 0)),
        "mute_clip_audio": lambda: bridge.mute_clip_audio(params.get("clip_index", 0), params.get("muted", True)),
        "add_audio_track": lambda: bridge.add_audio_track(params.get("name", "SFX")),
        "import_audio_to_track": lambda: bridge.import_audio_to_track(params.get("track_index", 1), params.get("file_path", ""), params.get("timeline_position", 0)),

        # Audio — Tier B
        "preprocess_audio": lambda: bridge.preprocess_audio(params.get("source_file_path", ""), params.get("start_time", 0), params.get("end_time", 0), params.get("filters", [])),
        "replace_clip_audio": lambda: bridge.replace_clip_audio(params.get("clip_index", 0), params.get("processed_audio_path", "")),

        # Timeline operations
        "add_adjustment_layer": lambda: bridge.add_adjustment_layer(params.get("start_frame", 0), params.get("end_frame", 0)),
        "set_composite_mode": lambda: bridge.set_composite_mode(params.get("clip_index", 0), params.get("mode", "Normal")),
        "duplicate_to_track": lambda: bridge.duplicate_to_track(params.get("clip_index", 0), params.get("target_track", 2)),
        "add_marker": lambda: bridge.add_marker(params.get("clip_index", 0), params.get("frame", 0), params.get("color", "Blue"), params.get("name", ""), params.get("note", "")),
        "razor_at": lambda: bridge.razor_at(params.get("clip_index", 0), params.get("frame", 0)),
        "set_speed_curve": lambda: bridge.set_speed_curve(params.get("clip_index", 0), params.get("keyframes", [])),

        # Clip properties
        "set_clip_opacity": lambda: bridge.set_clip_opacity(params.get("clip_index", 0), params.get("opacity", 1.0)),
        "set_retiming": lambda: bridge.set_retiming(params.get("clip_index", 0), params.get("mode", "optical_flow"), params.get("speed", 100)),
        "set_clip_transform": lambda: bridge.set_clip_transform(params.get("clip_index", 0), params.get("params", {})),

        # Effect management
        "get_clip_effects_state": lambda: bridge.get_clip_effects_state(params.get("clip_index", 0)),
        "remove_effect": lambda: bridge.remove_effect(params.get("clip_index", 0), params.get("effect_id", "")),
        "update_effect_param": lambda: bridge.update_effect_param(params.get("clip_index", 0), params.get("effect_id", ""), params.get("param", ""), params.get("value")),
        "bypass_effect": lambda: bridge.bypass_effect(params.get("clip_index", 0), params.get("effect_id", ""), params.get("bypassed", True)),
        "render_still": lambda: bridge.render_still(params.get("clip_index", 0), params.get("frame", 0), params.get("effects_mask")),
        "reorder_effects": lambda: bridge.reorder_effects(params.get("clip_index", 0), params.get("effect_ids", [])),

        # Masking
        "add_power_window": lambda: bridge.add_power_window(params.get("clip_index", 0), params.get("node_index"), params.get("window_type", "circular"), params.get("params")),
        "add_qualifier": lambda: bridge.add_qualifier(params.get("clip_index", 0), params.get("node_index"), params.get("qualifier_type", "hsl"), params.get("params")),
        "setup_magic_mask": lambda: bridge.setup_magic_mask(params.get("clip_index", 0), params.get("mask_mode", "person"), params.get("node_index")),
        "setup_masked_grade": lambda: bridge.setup_masked_grade(params.get("clip_index", 0), params.get("mask_type", "magic_mask"), params.get("mask_params"), params.get("grade_params"), params.get("invert", False)),
    }

    handler = actions.get(action)
    if handler:
        return handler()
    return {"error": f"Unknown action: {action}"}


def main():
    ensure_temp_dirs()
    bridge = ResolveBridge()

    print(json.dumps({"ready": True, "message": "SuperEdits Resolve Bridge started"}), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            command = json.loads(line)
            result = handle_command(bridge, command)
            print(json.dumps(result), flush=True)
        except json.JSONDecodeError:
            print(json.dumps({"error": "Invalid JSON"}), flush=True)
        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)


if __name__ == "__main__":
    main()
