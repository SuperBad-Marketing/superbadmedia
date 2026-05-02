"""
Shared utilities for the Resolve bridge modules.
"""

import uuid
import subprocess
import os
import shutil
import tempfile

TEMP_AUDIO_DIR = os.path.join(tempfile.gettempdir(), "superedits-audio")
TEMP_STILLS_DIR = os.path.join(tempfile.gettempdir(), "superedits-stills")


def ensure_temp_dirs():
    os.makedirs(TEMP_AUDIO_DIR, exist_ok=True)
    os.makedirs(TEMP_STILLS_DIR, exist_ok=True)


def generate_effect_id():
    return str(uuid.uuid4())


def get_clip(timeline, clip_index, track_type="video", track_index=1):
    if not timeline:
        return None, {"error": "No timeline active"}

    items = timeline.GetItemListInTrack(track_type, track_index)
    if not items or clip_index >= len(items):
        return None, {"error": f"Invalid clip index {clip_index}"}

    return items[clip_index], None


def get_all_video_clips(timeline):
    if not timeline:
        return []
    clips = []
    track_count = timeline.GetTrackCount("video")
    for t in range(1, track_count + 1):
        items = timeline.GetItemListInTrack("video", t)
        if items:
            for item in items:
                clips.append({"clip": item, "track": t})
    return clips


def check_ffmpeg():
    return shutil.which("ffmpeg") is not None


def check_sox():
    return shutil.which("sox") is not None


AUDIO_FILTER_MAP = {
    "lowpass": lambda p: f"lowpass=f={p.get('frequency', 4000)}",
    "highpass": lambda p: f"highpass=f={p.get('frequency', 80)}",
    "bandpass": lambda p: f"bandpass=f={p.get('frequency', 1000)}:width_type=h:w={p.get('bandwidth', 500)}",
    "reverb": lambda p: f"aecho=0.8:0.88:{int(p.get('delay', 60))}:{p.get('decay', 0.4)}",
    "echo": lambda p: f"aecho=0.6:0.3:{int(p.get('delay', 250))}:{p.get('decay', 0.5)}",
    "pitch": lambda p: f"asetrate=48000*{p.get('factor', 1.0)},aresample=48000",
    "speed": lambda p: f"atempo={p.get('speed', 1.0)}",
    "flanger": lambda p: f"flanger=delay={p.get('delay', 5)}:depth={p.get('depth', 2)}:speed={p.get('rate', 0.5)}",
    "phaser": lambda p: f"aphaser=speed={p.get('rate', 0.5)}:decay={p.get('decay', 0.4)}",
    "overdrive": lambda p: f"overdrive=gain={p.get('gain', 5)}",
    "downsample": lambda p: f"aresample={p.get('rate', 11025)}",
}


def build_ffmpeg_filter_chain(filters):
    parts = []
    for f in filters:
        ftype = f.get("type")
        builder = AUDIO_FILTER_MAP.get(ftype)
        if builder:
            parts.append(builder(f))
    return ",".join(parts) if parts else None
