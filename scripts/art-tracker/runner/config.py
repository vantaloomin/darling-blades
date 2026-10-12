# Shared paths for the runner. Nothing personal is hard-coded: set ART_DIR before running.
#   ART_DIR   art output folder (raw/, out/, logs/, prompts-revised/), kept outside the repo and never under public/
#   ART_WORK  scratch state (lists, prompts, tracker-local.json, patches); default $ART_DIR/work
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
ART_DIR = os.environ.get('ART_DIR') or sys.exit('set ART_DIR to the art output folder')
WORK = os.environ.get('ART_WORK') or os.path.join(ART_DIR, 'work')
os.makedirs(WORK, exist_ok=True)
TSX = os.path.join(REPO, 'node_modules', '.bin', 'tsx.cmd' if os.name == 'nt' else 'tsx')

def smartcrop_cmd(src, dst, mode, fig):
    return [sys.executable, os.path.join(REPO, 'scripts', 'smartcrop.py'), src, dst, '640', '800', mode] + (['--focal-frac', '0.1'] if fig else [])
