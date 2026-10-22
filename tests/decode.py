# Optional independent validation: requires pyembroidery installed in the test environment.
import json, sys, os, math
import pyembroidery as pe
pattern=json.load(open('/tmp/atelier-test.json'))
expected=[(math.floor(p['x']*10+.5),math.floor(p['y']*10+.5)) for p in pattern['commands'] if p['c']==0]
for ext in ('pes','dst'):
    result=pe.read('/tmp/atelier-test.'+ext)
    actual=[(int(x),int(y)) for x,y,c in result.stitches if c&255==0]
    assert actual==expected,(ext,len(actual),len(expected))
    print(ext,': independent decoder matches',len(actual),'needle points')
for filename in sys.argv[1:]:
    original=pe.read(filename)
    decoded=json.load(open('/tmp/atelier-import-'+os.path.basename(filename)+'.json'))
    expected=[(x/10,y/10,c&255) for x,y,c in original.stitches if c&255!=4]
    actual=[(p['x'],p['y'],p['c']) for p in decoded['commands']]
    assert actual==expected,filename
    assert decoded['colors']==[thread.hex_color().lower() for thread in original.threadlist]
    regenerated=pe.read('/tmp/atelier-rewrite-'+os.path.basename(filename))
    needle_original=[p for p in expected if p[2]==0]
    needle_regenerated=[(x/10,y/10,c&255) for x,y,c in regenerated.stitches if c&255==0]
    assert needle_original==needle_regenerated
    assert sum(c&255==2 for x,y,c in regenerated.stitches)==sum(c&255==2 for x,y,c in original.stitches)
    print(os.path.basename(filename),': coordinates, commands, RGB and cut requests verified')
