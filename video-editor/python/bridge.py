#!/usr/bin/env python3
"""
SuperEdits — DaVinci Resolve Bridge
Connects to Resolve's scripting API and executes commands.
Run alongside the SuperEdits app when editing.
"""

import sys
import json
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def get_resolve():
    """Connect to a running DaVinci Resolve instance."""
    try:
        import resolve_loader
        script_module = resolve_loader.load()
        if not script_module:
            return None
        resolve = script_module.scriptapp("Resolve")
        return resolve
    except Exception:
        return None


class ResolveBridge:
    def __init__(self):
        self.resolve = None
        self.project_manager = None
        self.project = None
        self.media_pool = None
        self.timeline = None

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
            result = self.media_pool.AppendToTimeline(clips_to_add)
            return {"success": True, "added": len(clips_to_add)}

        return {"error": "No valid clips to add"}

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
        """Apply grade adjustments to a clip via Resolve's property system.
        grade_params can include CDL-compatible keys like lift, gamma, gain,
        contrast, saturation, etc."""
        if not self.timeline:
            return {"error": "No timeline active"}

        track_clips = self.timeline.GetItemListInTrack("video", 1)
        if not track_clips or clip_index >= len(track_clips):
            return {"error": "Invalid clip index"}

        clip = track_clips[clip_index]

        # Resolve color grading works through the Color page.
        # We adjust primary properties via CDL (Color Decision List)
        # available through clip properties.
        applied = {}
        for param, value in grade_params.items():
            try:
                result = clip.SetProperty(param, value)
                if result:
                    applied[param] = value
                else:
                    applied[param] = "not applied"
            except Exception as e:
                applied[param] = f"failed: {str(e)}"

        return {"success": True, "applied": applied}

    def apply_lut(self, clip_index, lut_path):
        if not self.timeline:
            return {"error": "No timeline active"}

        track_clips = self.timeline.GetItemListInTrack("video", 1)
        if not track_clips or clip_index >= len(track_clips):
            return {"error": "Invalid clip index"}

        clip = track_clips[clip_index]

        try:
            # SetLUT takes a node index and a path string.
            # Apply to the last node in the clip's grade.
            node_count = clip.GetNumNodes()
            result = clip.SetLUT(node_count, lut_path)
            return {"success": bool(result), "lut_path": lut_path, "node": node_count}
        except Exception as e:
            return {"error": str(e)}

    def add_transition(self, clip_index, transition_type="Cross Dissolve", duration=1.0):
        """Add a transition between clips on the timeline."""
        if not self.timeline:
            return {"error": "No timeline active"}

        track_clips = self.timeline.GetItemListInTrack("video", 1)
        if not track_clips or clip_index >= len(track_clips):
            return {"error": "Invalid clip index"}

        clip = track_clips[clip_index]
        try:
            result = clip.AddTransition("End", transition_type, duration)
            return {"success": bool(result), "transition": transition_type, "duration": duration}
        except Exception as e:
            return {"error": f"Failed to add transition: {str(e)}"}

    def set_clip_speed(self, clip_index, speed_percent):
        """Change playback speed of a clip (100 = normal speed)."""
        if not self.timeline:
            return {"error": "No timeline active"}

        track_clips = self.timeline.GetItemListInTrack("video", 1)
        if not track_clips or clip_index >= len(track_clips):
            return {"error": "Invalid clip index"}

        clip = track_clips[clip_index]
        try:
            result = clip.SetClipProperty("Speed", speed_percent)
            return {"success": bool(result), "speed": speed_percent}
        except Exception as e:
            return {"error": str(e)}

    def add_fusion_comp(self, clip_index, fusion_script=""):
        """Add a Fusion composition to a clip."""
        if not self.timeline:
            return {"error": "No timeline active"}

        track_clips = self.timeline.GetItemListInTrack("video", 1)
        if not track_clips or clip_index >= len(track_clips):
            return {"error": "Invalid clip index"}

        clip = track_clips[clip_index]
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
        "connect": lambda: bridge.connect(),
        "status": lambda: bridge.get_status(),
        "create_project": lambda: bridge.create_project(**params),
        "import_media": lambda: bridge.import_media(params.get("file_paths", [])),
        "create_timeline": lambda: bridge.create_timeline(params.get("name", "Timeline 1")),
        "add_clips": lambda: bridge.add_clips_to_timeline(params.get("clip_indices", [])),
        "get_timeline_clips": lambda: bridge.get_timeline_clips(),
        "set_grade": lambda: bridge.set_clip_color_grade(params.get("clip_index", 0), params.get("grade_params", {})),
        "apply_lut": lambda: bridge.apply_lut(params.get("clip_index", 0), params.get("lut_path", "")),
        "add_transition": lambda: bridge.add_transition(params.get("clip_index", 0), params.get("transition_type", "Cross Dissolve"), params.get("duration", 1.0)),
        "set_clip_speed": lambda: bridge.set_clip_speed(params.get("clip_index", 0), params.get("speed_percent", 100)),
        "add_fusion_comp": lambda: bridge.add_fusion_comp(params.get("clip_index", 0), params.get("fusion_script", "")),
        "render": lambda: bridge.render(**params),
        "render_status": lambda: bridge.get_render_status(),
    }

    handler = actions.get(action)
    if handler:
        return handler()
    return {"error": f"Unknown action: {action}"}


def main():
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
