#!/usr/bin/env python3
"""
SuperEdits — DaVinci Resolve Bridge
Connects to Resolve's scripting API and executes commands.
Run alongside the SuperEdits app when editing.
"""

import sys
import json
import os

def get_resolve():
    """Connect to a running DaVinci Resolve instance."""
    try:
        script_module = None

        # macOS paths
        resolve_script_paths = [
            "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules",
            os.path.expanduser("~/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules"),
        ]

        for p in resolve_script_paths:
            if os.path.exists(p) and p not in sys.path:
                sys.path.append(p)

        import DaVinciResolveScript as dvr
        resolve = dvr.scriptapp("Resolve")
        return resolve
    except ImportError:
        return None
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
        """Apply grade adjustments to a clip. grade_params can include:
        lift, gamma, gain (each as [r, g, b, y] arrays), contrast, saturation, etc."""
        if not self.timeline:
            return {"error": "No timeline active"}

        track_clips = self.timeline.GetItemListInTrack("video", 1)
        if not track_clips or clip_index >= len(track_clips):
            return {"error": "Invalid clip index"}

        clip = track_clips[clip_index]

        # Apply grade parameters through the clip's color properties
        for param, value in grade_params.items():
            try:
                clip.SetProperty(param, value)
            except Exception:
                pass

        return {"success": True}

    def apply_lut(self, clip_index, lut_path):
        if not self.timeline:
            return {"error": "No timeline active"}

        track_clips = self.timeline.GetItemListInTrack("video", 1)
        if not track_clips or clip_index >= len(track_clips):
            return {"error": "Invalid clip index"}

        clip = track_clips[clip_index]

        try:
            node_count = clip.GetNumNodes()
            clip.SetLUT(node_count, {"node_index": node_count, "lut_path": lut_path})
            return {"success": True}
        except Exception as e:
            return {"error": str(e)}

    def render(self, output_path, format_preset="H.264 Master", width=1920, height=1080):
        if not self.project:
            return {"error": "No project open"}

        self.project.SetRenderSettings({
            "TargetDir": output_path,
            "FormatWidth": width,
            "FormatHeight": height,
        })

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
