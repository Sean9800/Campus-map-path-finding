/* ---------- A* (self-contained so it can be exported as-is) ---------- */
function findPath(grid, sx, sy, ex, ey, diagonal){
  const cols = grid.cols, rows = grid.rows;
  const ok = (c,r) => c>=0 && r>=0 && c<cols && r<rows && grid.data[r][c]==='1';
  if(!ok(sx,sy) || !ok(ex,ey)) return null;
  const key = (c,r) => r*cols + c;
  const g = new Map(), came = new Map(), closed = new Set();
  const h = (c,r) => { const dx=Math.abs(c-ex), dy=Math.abs(r-ey);
    return diagonal ? (dx+dy) + (Math.SQRT2-2)*Math.min(dx,dy) : dx+dy; };
  const open = [{c:sx, r:sy, f:h(sx,sy)}];
  g.set(key(sx,sy), 0);
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  if(diagonal) dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
  while(open.length){
    let bi = 0;
    for(let i=1;i<open.length;i++) if(open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi,1)[0];
    const ck = key(cur.c, cur.r);
    if(closed.has(ck)) continue;
    if(cur.c===ex && cur.r===ey){
      const path = [[cur.c, cur.r]]; let k = ck;
      while(came.has(k)){ k = came.get(k); path.push([k % cols, Math.floor(k / cols)]); }
      return path.reverse();
    }
    closed.add(ck);
    for(const [dc,dr] of dirs){
      const nc = cur.c+dc, nr = cur.r+dr;
      if(!ok(nc,nr)) continue;
      if(dc && dr && (!ok(cur.c+dc, cur.r) || !ok(cur.c, cur.r+dr))) continue; // no corner cutting
      const nk = key(nc,nr);
      if(closed.has(nk)) continue;
      const ng = g.get(ck) + ((dc && dr) ? Math.SQRT2 : 1);
      if(!g.has(nk) || ng < g.get(nk)){
        g.set(nk, ng); came.set(nk, ck);
        open.push({c:nc, r:nr, f: ng + h(nc,nr)});
      }
    }
  }
  return null;
}

/* ---------- Editor state ---------- */
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
let img = null, cellSize = 20, cols = 0, rows = 0, cells = new Uint8Array(0);
let mode = 'paint', painting = false, start = null, end = null, path = null;

function initGrid(){
  cellSize = Math.max(4, Math.min(80, parseInt($('cellSize').value,10) || 20));
  cols = Math.ceil(canvas.width / cellSize);
  rows = Math.ceil(canvas.height / cellSize);
  cells = new Uint8Array(cols*rows);
  start = end = path = null;
  refresh();
}
function toGrid(){
  const data = [];
  for(let r=0;r<rows;r++){
    let s = '';
    for(let c=0;c<cols;c++) s += cells[r*cols+c] ? '1' : '0';
    data.push(s);
  }
  return { cellSize, cols, rows, width: canvas.width, height: canvas.height, data };
}
function setStatus(t){ $('status').textContent = t || ''; }

$('fileInput').addEventListener('change', e => {
  const f = e.target.files[0]; if(!f) return;
  const rd = new FileReader();
  rd.onload = ev => {
    img = new Image();
    img.onload = () => { canvas.width = img.naturalWidth; canvas.height = img.naturalHeight; initGrid(); };
    img.src = ev.target.result;
  };
  rd.readAsDataURL(f);
});

$('cellSize').addEventListener('change', () => {
  if(cells.some(v=>v) && !confirm('Changing the cell size resets the painted grid. Continue?')){ $('cellSize').value = cellSize; return; }
  initGrid();
});
['showGrid'].forEach(id => $(id).addEventListener('change', draw));
$('diag').addEventListener('change', () => { runTest(); draw(); });

function setMode(m){
  mode = m; start = end = path = null;
  $('mPaint').classList.toggle('active', m==='paint');
  $('mErase').classList.toggle('active', m==='erase');
  $('mTest').classList.toggle('active', m==='test');
  setStatus(m==='test' ? 'Click a walkable start cell, then a walkable end cell.' : '');
  draw();
}
$('mPaint').onclick = () => setMode('paint');
$('mErase').onclick = () => setMode('erase');
$('mTest').onclick = () => setMode('test');

function cellAt(e){
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return [Math.floor(x / cellSize), Math.floor(y / cellSize)];
}
function paintAt(c, r){
  const b = Math.max(1, parseInt($('brush').value,10) || 1);
  const lo = -Math.floor((b-1)/2), hi = Math.floor(b/2);
  const val = mode === 'paint' ? 1 : 0;
  for(let dr=lo; dr<=hi; dr++) for(let dc=lo; dc<=hi; dc++){
    const cc=c+dc, rr=r+dr;
    if(cc>=0 && rr>=0 && cc<cols && rr<rows) cells[rr*cols+cc] = val;
  }
}
canvas.addEventListener('pointerdown', e => {
  const [c,r] = cellAt(e);
  if(mode === 'test'){
    if(c<0||r<0||c>=cols||r>=rows) return;
    if(!cells[r*cols+c]){ setStatus('That cell is not walkable - pick a green cell.'); return; }
    if(!start || (start && end)){ start = [c,r]; end = null; path = null; setStatus('Now click the destination.'); }
    else { end = [c,r]; runTest(); }
    draw(); return;
  }
  painting = true; canvas.setPointerCapture(e.pointerId);
  paintAt(c,r); refresh();
});
canvas.addEventListener('pointermove', e => {
  if(!painting) return;
  const [c,r] = cellAt(e); paintAt(c,r); refresh();
});
['pointerup','pointercancel'].forEach(ev => canvas.addEventListener(ev, () => { painting = false; }));

function runTest(){
  if(!(start && end)) return;
  path = findPath(toGrid(), start[0], start[1], end[0], end[1], $('diag').checked);
  if(path){
    let len = 0;
    for(let i=1;i<path.length;i++){
      const d = (path[i][0]!==path[i-1][0] && path[i][1]!==path[i-1][1]) ? Math.SQRT2 : 1;
      len += d * cellSize;
    }
    setStatus(`Path found: ${path.length} cells, about ${Math.round(len)} px long. Click again to test another.`);
  } else setStatus('No walkable route between those cells - there is a gap in your painted area.');
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(img) ctx.drawImage(img,0,0,canvas.width,canvas.height);
  else { ctx.fillStyle='#ddd'; ctx.fillRect(0,0,canvas.width,canvas.height); }
  ctx.fillStyle = 'rgba(46,160,90,0.45)';
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++)
    if(cells[r*cols+c]) ctx.fillRect(c*cellSize, r*cellSize, cellSize, cellSize);
  if($('showGrid').checked){
    ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=1; ctx.beginPath();
    for(let c=0;c<=cols;c++){ ctx.moveTo(c*cellSize+.5,0); ctx.lineTo(c*cellSize+.5,canvas.height); }
    for(let r=0;r<=rows;r++){ ctx.moveTo(0,r*cellSize+.5); ctx.lineTo(canvas.width,r*cellSize+.5); }
    ctx.stroke();
  }
  if(path){
    ctx.strokeStyle='#C08A2E'; ctx.lineWidth=Math.max(3,cellSize/4); ctx.lineJoin='round'; ctx.beginPath();
    path.forEach(([c,r],i) => { const x=(c+.5)*cellSize, y=(r+.5)*cellSize; i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
    ctx.stroke();
  }
  const dot = (p,col) => { if(!p) return; ctx.beginPath(); ctx.arc((p[0]+.5)*cellSize,(p[1]+.5)*cellSize,Math.max(5,cellSize/2.2),0,Math.PI*2);
    ctx.fillStyle=col; ctx.fill(); ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke(); };
  dot(start,'#1E4C52'); dot(end,'#a8452f');
}
function refresh(){
  let n = 0; for(let i=0;i<cells.length;i++) n += cells[i];
  $('info').textContent = `${cols}×${rows} cells · ${n} walkable`;
  draw();
}

$('fillAll').onclick = () => { cells.fill(1); path=null; refresh(); };
$('clearGrid').onclick = () => { if(cells.some(v=>v) && !confirm('Clear all walkable cells?')) return; cells.fill(0); start=end=path=null; refresh(); };

$('exportBtn').onclick = () => {
  const g = toGrid();
  const dataLines = g.data.map(s => '  "' + s + '"').join(',\n');
  $('output').value =
`// Walkable grid: "1" = walkable, "0" = blocked. One string per row.
// Coordinates are in the same pixel space as your map image (${g.width}x${g.height}).
const walkGrid = {"cellSize":${g.cellSize},"cols":${g.cols},"rows":${g.rows},"width":${g.width},"height":${g.height},"data":[
${dataLines}
]};

// Convert between map pixels and grid cells
function pixelToCell(x, y){ return [Math.floor(x / walkGrid.cellSize), Math.floor(y / walkGrid.cellSize)]; }
function cellToPixel(c, r){ return [(c + 0.5) * walkGrid.cellSize, (r + 0.5) * walkGrid.cellSize]; }

// A* pathfinding. Returns an array of [col,row] cells, or null if unreachable.
${findPath.toString()}

// Example: route between two map-pixel positions, returned as pixel points
// const [sc,sr] = pixelToCell(60,230), [ec,er] = pixelToCell(150,190);
// const cells = findPath(walkGrid, sc, sr, ec, er, true);
// const pixelPath = cells && cells.map(([c,r]) => cellToPixel(c,r));
`;
};

$('importBtn').onclick = () => {
  const t = $('importBox').value;
  const a = t.indexOf('{'), b = t.indexOf(']}');
  try{
    const obj = JSON.parse(t.slice(a, b+2));
    if(!obj.data || !obj.cols || !obj.rows) throw new Error('missing fields');
    if(!img){ canvas.width = obj.width; canvas.height = obj.height; }
    $('cellSize').value = obj.cellSize;
    cellSize = obj.cellSize; cols = obj.cols; rows = obj.rows;
    cells = new Uint8Array(cols*rows);
    obj.data.forEach((s,r) => { for(let c=0;c<cols;c++) cells[r*cols+c] = s[c]==='1' ? 1 : 0; });
    start=end=path=null; refresh();
    setStatus('Grid loaded. Load the matching map image to see it in context.');
  } catch(err){ setStatus('Could not read that grid - paste the whole walkGrid block, including the closing ]};'); }
};

initGrid();
