/* app.js — Meme Sound Battle multi-file app
   Features:
   - Upload up to 8 audio files + optional cover image (apply cover to next)
   - Upload optional video (sample provided)
   - Intro TTS preview (native) + robotic (WebAudio) recordable voice
   - Canvas funnel drop drawn to canvases
   - Canvas compositing + MediaRecorder to record video + mixed audio
   - Links.json maintenance (client-side)
   - MediaFire upload placeholder (you must add credentials/server-side for real uploads)
*/

// ---- Simple helpers ----
const $ = id => document.getElementById(id);
const MAX_ITEMS = 8;

// ---- Elements ----
const audioFiles = $('audioFiles');
const audioDrop = $('audioDrop');
const videoFile = $('videoFile');
const videoDrop = $('videoDrop');
const useSample = $('useSample');
const addDemo = $('addDemo');
const itemsEl = $('items');
const startRecordBtn = $('startRecord');
const stopRecordBtn = $('stopRecord');
const downloadRecordBtn = $('downloadRecord');
const lastDownload = $('lastDownload');
const recordFormat = $('recordFormat');
const startBattleBtn = $('startBattle');
const previewDropBtn = $('previewDrop');
const resetArenaBtn = $('resetArena');
const leaderboardEl = $('leaderboard');
const linksJSONEl = $('linksJSON');
const uploadLastBtn = $('uploadLast');
const exportJSON = $('exportJSON');
const mediafireSession = $('mediafireSession');
const introText = $('introText');
const autoIntro = $('autoIntro');
const voiceSelect = $('voiceSelect');
const previewVoice = $('previewVoice');
const robotVoiceCheckbox = $('robotVoice');
const useSampleBtn = useSample;
const bgFull = document.getElementById('bgFull');

const bgCanvas = $('bgCanvas'), funnelCanvas = $('funnelCanvas'), uiCanvas = $('uiCanvas');
const canvasWrap = $('canvasWrap');

let items = []; // {id,name,audioUrl,coverUrl,audioEl,srcNode}
let avatars = [];
let landingOrder = [];
let mediaLinks = []; // saved links array in-memory
let recordedBlob = null;
let audioCtx, masterGain, masterDestination, mediaRecorder;
let compositeCanvas, compCtx;
let recordingChunks = [];
let animLoop = null;
let recordingFormatChosen = 'video/webm';
let sampleVideoName = 'sample_trimmed.mp4'; // file you put in site root

// ---- resize canvases ----
function fitCanvases(){
  const rect = canvasWrap.getBoundingClientRect();
  [bgCanvas, funnelCanvas, uiCanvas].forEach(c=>{
    c.width = rect.width;
    c.height = rect.height;
    c.style.width = rect.width + 'px';
    c.style.height = rect.height + 'px';
  });
}
window.addEventListener('resize', fitCanvases);
fitCanvases();

// contexts
const bgCtx = bgCanvas.getContext('2d');
const fCtx = funnelCanvas.getContext('2d');
const uCtx = uiCanvas.getContext('2d');

// ---- Background animation (particles) ----
let particles = [];
function initParticles(){
  const W = bgCanvas.width, H = bgCanvas.height;
  particles = [];
  for (let i=0;i<22;i++){
    particles.push({x:Math.random()*W,y:Math.random()*H,r:40+Math.random()*160,vx:(Math.random()-0.5)*0.6,vy:(Math.random()-0.5)*0.6,h:200+Math.random()*80,a:0.05+Math.random()*0.06});
  }
}
function drawBG(){
  const W = bgCanvas.width, H = bgCanvas.height;
  bgCtx.clearRect(0,0,W,H);
  // gradient background
  const g = bgCtx.createLinearGradient(0,0,W,H);
  g.addColorStop(0,'#001020'); g.addColorStop(1,'#05233b');
  bgCtx.fillStyle = g; bgCtx.fillRect(0,0,W,H);
  particles.forEach(p=>{
    p.x += p.vx; p.y += p.vy;
    if (p.x < -p.r) p.x = W + p.r;
    if (p.x > W + p.r) p.x = -p.r;
    if (p.y < -p.r) p.y = H + p.r;
    if (p.y > H + p.r) p.y = -p.r;
    const rg = bgCtx.createRadialGradient(p.x,p.y,p.r*0.1,p.x,p.y,p.r);
    rg.addColorStop(0,`hsla(${p.h},80%,70%,${p.a})`);
    rg.addColorStop(1,`hsla(${p.h},60%,30%,0)`);
    bgCtx.fillStyle = rg;
    bgCtx.beginPath(); bgCtx.arc(p.x,p.y,p.r,0,Math.PI*2); bgCtx.fill();
  });
  requestAnimationFrame(drawBG);
}
initParticles(); drawBG();

// ---- Funnel base ----
function drawFunnelBase(){
  const w = funnelCanvas.width, h = funnelCanvas.height;
  fCtx.clearRect(0,0,w,h);
  const p1 = {x:w*0.2,y:0}, p2={x:w*0.8,y:0}, p3={x:w*0.95,y:h*0.78}, p4={x:w*0.5,y:h}, p5={x:w*0.05,y:h*0.78};
  const grad = fCtx.createLinearGradient(0,0,0,h); grad.addColorStop(0,'#7bb8ff'); grad.addColorStop(1,'#3ea0ff');
  fCtx.fillStyle = grad;
  fCtx.beginPath(); fCtx.moveTo(p1.x,p1.y); fCtx.lineTo(p2.x,p2.y); fCtx.lineTo(p3.x,p3.y); fCtx.lineTo(p4.x,p4.y); fCtx.lineTo(p5.x,p5.y); fCtx.closePath(); fCtx.fill();
}
drawFunnelBase();

// ---- Items UI ----
function renderItems(){
  itemsEl.innerHTML = '';
  items.forEach((it, idx) => {
    const el = document.createElement('div'); el.className='sound-item';
    const cov = document.createElement('div'); cov.className='cover';
    if (it.coverUrl){ const img = document.createElement('img'); img.src = it.coverUrl; img.style.width='100%'; img.style.height='100%'; img.style.objectFit='cover'; cov.innerHTML=''; cov.appendChild(img); } else cov.textContent = idx+1;
    el.appendChild(cov);

    const meta = document.createElement('div'); meta.style.flex='1';
    const name = document.createElement('input'); name.value = it.name; name.addEventListener('input', ()=> it.name = name.value);
    meta.appendChild(name);
    const ctrls = document.createElement('div'); ctrls.style.marginTop='6px';
    const play = document.createElement('button'); play.className='btn small'; play.textContent='Play'; play.onclick = ()=> { it.audioEl.currentTime=0; it.audioEl.play(); };
    const rem = document.createElement('button'); rem.className='btn small'; rem.textContent='Remove'; rem.onclick = ()=> { items.splice(idx,1); renderItems(); };
    ctrls.appendChild(play); ctrls.appendChild(rem);
    meta.appendChild(ctrls);
    el.appendChild(meta);
    itemsEl.appendChild(el);
  });
  updateIntroAuto();
}

// ---- Upload handling ----
audioDrop.addEventListener('click', ()=> audioFiles.click());
audioFiles.addEventListener('change', (e)=>{
  const files = Array.from(e.target.files);
  for (const f of files){
    if (items.length >= MAX_ITEMS) break;
    const url = URL.createObjectURL(f);
    const audioEl = new Audio(url); audioEl.preload='auto';
    items.push({id:Date.now()+Math.random(), name:f.name.replace(/\.[^/.]+$/,''), audioUrl:url, coverUrl:null, audioEl});
  }
  renderItems();
});

videoDrop.addEventListener('click', ()=> videoFile.click());
videoFile.addEventListener('change', (e)=>{
  const f = e.target.files[0];
  if (!f) return;
  // set sample video pointer to uploaded
  sampleVideoName = URL.createObjectURL(f);
  alert('Custom video selected');
});

useSampleBtn.addEventListener('click', ()=> {
  sampleVideoName = 'sample_trimmed.mp4';
  alert('Using bundled sample (you must include sample_trimmed.mp4 at site root)');
});

// add demo sounds quick
addDemo.addEventListener('click', ()=>{
  const demo = [
    {name:'VineBoom', url:'https://cdn.jsdelivr.net/gh/jshang/myinstants-scrape@master/sounds/vine-boom.mp3'},
    {name:'Bruh', url:'https://cdn.jsdelivr.net/gh/jshang/myinstants-scrape@master/sounds/bruh.mp3'},
  ];
  for (const d of demo){
    if (items.length >= MAX_ITEMS) break;
    const el = new Audio(d.url); el.preload='auto';
    items.push({id:Date.now()+Math.random(), name:d.name, audioUrl:d.url, coverUrl:null, audioEl:el});
  }
  renderItems();
});

// ---- Voices ----
function populateVoices(){
  const vs = speechSynthesis.getVoices();
  voiceSelect.innerHTML = '';
  vs.forEach(v => { const o = document.createElement('option'); o.value=v.name; o.textContent = v.name + ' ('+v.lang+')'; voiceSelect.appendChild(o); });
}
speechSynthesis.onvoiceschanged = populateVoices;
populateVoices();
previewVoice.addEventListener('click', ()=> {
  const text = introText.value || 'Ready';
  const u = new SpeechSynthesisUtterance(text);
  const v = voiceSelect.value;
  const vs = speechSynthesis.getVoices();
  const found = vs.find(x=>x.name===v);
  if (found) u.voice = found;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
});

// update intro text automatically
function updateIntroAuto(){
  if (autoIntro.checked){
    introText.value = items.map(i => i.name).join(' vs ');
  }
  drawUI();
}

// ---- Audio graph & recording ----
function initAudioGraph(){
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain(); masterGain.gain.value = 1;
  masterDestination = audioCtx.createMediaStreamDestination();
  masterGain.connect(audioCtx.destination);
  masterGain.connect(masterDestination);
}

startRecordBtn.addEventListener('click', startRecording);
stopRecordBtn.addEventListener('click', stopRecording);
downloadRecordBtn.addEventListener('click', ()=> {
  if (!recordedBlob) { alert('No recording yet'); return; }
  const url = URL.createObjectURL(recordedBlob);
  lastDownload.href = url;
  lastDownload.download = 'meme-battle.' + (recordedBlob.type.includes('mp4')? 'mp4':'webm');
  lastDownload.textContent = 'Download last recording';
});

// start recording: composite canvases and mix audio tracks
function startRecording(){
  if (mediaRecorder && mediaRecorder.state === 'recording'){ alert('Already recording'); return; }
  if (!items.length){ if (!confirm('No audio items added. Record anyway?')) return; }
  initAudioGraph();
  // connect item audio elements to audio context
  items.forEach(it => {
    try{
      if (!it.srcNode){
        it.srcNode = audioCtx.createMediaElementSource(it.audioEl);
        it.srcNode.connect(masterGain);
      }
    } catch(e){}
  });

  // composite canvas
  compositeCanvas = document.createElement('canvas'); compositeCanvas.width = funnelCanvas.width; compositeCanvas.height = funnelCanvas.height;
  compCtx = compositeCanvas.getContext('2d');

  let compRunning = true;
  function compositeLoop(){
    if (!compRunning) return;
    compCtx.clearRect(0,0,compositeCanvas.width,compositeCanvas.height);
    compCtx.drawImage(bgCanvas,0,0,compositeCanvas.width,compositeCanvas.height);
    compCtx.drawImage(funnelCanvas,0,0,compositeCanvas.width,compositeCanvas.height);
    compCtx.drawImage(uiCanvas,0,0,compositeCanvas.width,compositeCanvas.height);
    requestAnimationFrame(compositeLoop);
  }
  compositeLoop();

  const canvasStream = compositeCanvas.captureStream(30);
  const dest = masterDestination; // media stream from audio graph
  const mixed = new MediaStream();
  canvasStream.getVideoTracks().forEach(t => mixed.addTrack(t));
  dest.stream.getAudioTracks().forEach(t => mixed.addTrack(t));

  const fmt = recordFormat.value || 'video/webm';
  let mime = fmt;
  try{
    mediaRecorder = new MediaRecorder(mixed, { mimeType: mime });
  } catch(e){
    try { mediaRecorder = new MediaRecorder(mixed); } catch(err) { alert('Recording not supported in this browser'); return; }
  }
  recordingChunks = [];
  mediaRecorder.ondataavailable = ev => { if (ev.data && ev.data.size) recordingChunks.push(ev.data); };
  mediaRecorder.onstop = ev => {
    recordedBlob = new Blob(recordingChunks, { type: mediaRecorder.mimeType || 'video/webm' });
    const url = URL.createObjectURL(recordedBlob);
    lastDownload.href = url;
    lastDownload.download = 'meme-battle.' + (recordedBlob.type.includes('mp4')? 'mp4':'webm');
    lastDownload.textContent = 'Download last recording';
    // save to links
    mediaLinks.push({timestamp: Date.now(), file: lastDownload.download, url});
    updateLinksJSON();
    // stop composite loop
    compRunning = false;
  };
  mediaRecorder.start();
  $('status').textContent = 'Recording...';
  // auto stop safety at 120s
  setTimeout(()=> { if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop(); }, 120000);
}

function stopRecording(){
  if (!mediaRecorder || mediaRecorder.state !== 'recording'){ alert('Not recording'); return; }
  mediaRecorder.stop();
  $('status').textContent = 'Recording stopped';
}

// ---- Battle animation logic ----
function spawnAvatars(){
  avatars = [];
  landingOrder = [];
  const w = funnelCanvas.width, h = funnelCanvas.height;
  items.forEach((it, idx)=>{
    const startX = w*0.2 + Math.random()*w*0.6;
    avatars.push({ item: it, x: startX, y:-90, vy:0, landed:false, bounce:0, id: Date.now()+''+idx, img: null });
    if (it.coverUrl){ const img = new Image(); img.src = it.coverUrl; avatars[avatars.length-1].img = img; }
  });
  if (!animLoop) animLoop = requestAnimationFrame(animate);
}

function animate(){
  drawFunnelBase();
  const bottom = funnelCanvas.height - 100;
  avatars.forEach((av, i) => {
    av.vy += 0.36;
    av.y += av.vy;
    if (!av.landed && av.y >= bottom){
      av.bounce++;
      av.vy = -av.vy * (0.45 + Math.random()*0.15);
      if (av.bounce > 1){ av.landed = true; onAvatarLand(av); }
    }
    // draw avatar
    const ax = av.x, ay = av.y, r = 38;
    fCtx.save();
    if (av.img && av.img.complete){
      fCtx.beginPath(); fCtx.arc(ax+r, ay+r, r, 0, Math.PI*2); fCtx.clip();
      fCtx.drawImage(av.img, ax, ay, r*2, r*2);
      fCtx.restore();
    } else {
      fCtx.fillStyle = '#123'; fCtx.fillRect(ax,ay,r*2,r*2);
      fCtx.fillStyle = '#fff'; fCtx.font = 'bold 14px sans-serif'; fCtx.fillText(av.item.name.slice(0,2).toUpperCase(), ax+r-10, ay+r+6);
    }
    // label
    fCtx.fillStyle = 'rgba(0,0,0,0.6)'; fCtx.fillRect(ax + r - 40, ay + r*2 + 8, 100, 22);
    fCtx.fillStyle = '#fff'; fCtx.font = '12px sans-serif'; fCtx.fillText(av.item.name, ax + r - 36, ay + r*2 + 24);
  });
  drawUI();
  animLoop = requestAnimationFrame(animate);
}

function onAvatarLand(av){
  try{ av.item.audioEl.currentTime = 0; av.item.audioEl.play(); } catch(e){}
  if (!landingOrder.find(x=>x.id===av.id)){
    landingOrder.push({id:av.id, name:av.item.name, cover:av.item.coverUrl});
    renderLeaderboard();
    if (landingOrder.length === 1){
      setTimeout(()=> announceWinner(landingOrder[0]), 360);
    }
  }
}

function renderLeaderboard(){
  leaderboardEl.innerHTML = '';
  landingOrder.forEach((l,i)=>{
    const row = document.createElement('div'); row.className='leaderRow'; row.style.display='flex'; row.style.gap='8px'; row.style.alignItems='center';
    const pos = document.createElement('div'); pos.textContent = (i+1); pos.style.width='28px';
    const cov = document.createElement('div'); cov.style.width='46px'; cov.style.height='46px';
    if (l.cover){ const img = document.createElement('img'); img.src = l.cover; img.style.width='100%'; img.style.height='100%'; img.style.objectFit='cover'; cov.appendChild(img); } else cov.textContent = l.name.slice(0,2).toUpperCase();
    const nm = document.createElement('div'); nm.textContent = l.name; nm.style.fontWeight='700';
    row.appendChild(pos); row.appendChild(cov); row.appendChild(nm);
    leaderboardEl.appendChild(row);
  });
  updateLinksJSON();
}

function announceWinner(w){
  if (robotVoiceCheckbox.checked) roboticSpeak(w.name + ' is the winner');
  else { const u = new SpeechSynthesisUtterance(w.name + ' is the winner'); speechSynthesis.speak(u); }
  const winnerBox = document.getElementById('winnerBox');
  if (winnerBox) winnerBox.innerHTML = '<strong>'+w.name+'</strong>';
}

function roboticSpeak(text, timeOffset=0){
  if (!audioCtx) initAudioGraph();
  const words = text.split(/\s+/).slice(0,16);
  let t = audioCtx.currentTime + timeOffset;
  words.forEach((w, idx)=>{
    const o = audioCtx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 220 + idx*40;
    const g = audioCtx.createGain();
    g.gain.value = 0;
    o.connect(g); g.connect(masterGain);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9, t+0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t+0.12);
    o.start(t); o.stop(t+0.14);
    t += 0.16;
  });
}

// ---- Preview / controls binding ----
previewDropBtn.addEventListener('click', ()=>{
  spawnAvatars();
  // preview speak
  if (robotVoiceCheckbox.checked) roboticSpeak(introText.value || 'Ready');
  else { const u = new SpeechSynthesisUtterance(introText.value || 'Ready'); speechSynthesis.speak(u); }
});

startBattleBtn.addEventListener('click', ()=>{
  if (autoIntro.checked) introText.value = items.map(i=>i.name).join(' vs ');
  if (robotVoiceCheckbox.checked){ roboticSpeak(introText.value || 'Ready'); setTimeout(()=> spawnAvatars(), 700 + items.length*50); }
  else { const u = new SpeechSynthesisUtterance(introText.value || 'Ready'); u.onend = ()=> spawnAvatars(); speechSynthesis.speak(u); }
});

resetArenaBtn.addEventListener('click', ()=>{
  cancelAnimationFrame(animLoop); animLoop = null;
  avatars = []; landingOrder = []; fCtx.clearRect(0,0,funnelCanvas.width,funnelCanvas.height); drawFunnelBase(); renderLeaderboard();
});

// ---- Links JSON and MediaFire placeholder ----
function updateLinksJSON(){
  linksJSONEl.textContent = JSON.stringify(mediaLinks, null, 2);
}
exportJSON && exportJSON.addEventListener('click', ()=>{
  const b = new Blob([JSON.stringify(mediaLinks, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(b);
  const a = document.createElement('a'); a.href = url; a.download = 'links.json'; a.click();
});

uploadLastBtn && uploadLastBtn.addEventListener('click', async ()=>{
  if (!recordedBlob){ alert('No recording to upload'); return; }
  const token = mediafireSession.value.trim();
  if (!token){ alert('No MediaFire token provided — function will return a local blob URL instead.'); const url = URL.createObjectURL(recordedBlob); mediaLinks.push({timestamp:Date.now(), url, filename:'local_recording'}); updateLinksJSON(); return; }
  // Placeholder: in real use implement server-side MediaFire flow or client-side with secure token.
  try{
    const url = await mediafireUploadPlaceholder(recordedBlob, token);
    mediaLinks.push({timestamp:Date.now(), url, filename:'uploaded_remote'});
    updateLinksJSON();
    alert('Upload recorded (placeholder): ' + url);
  } catch(e){ alert('Upload failed: '+e.message); }
});

async function mediafireUploadPlaceholder(blob, token){
  // This just returns a blob URL as a simulation.
  // Replace this function with server-side uploading if you want real MediaFire hosting.
  return URL.createObjectURL(blob);
}

// ---- init UI ----
function init(){
  renderItems();
  drawFunnelBase();
  drawUI();
}
function drawUI(){
  const w = uiCanvas.width, h = uiCanvas.height;
  uCtx.clearRect(0,0,w,h);
  uCtx.fillStyle = '#fff';
  uCtx.font = '22px sans-serif'; uCtx.textAlign = 'center';
  uCtx.fillText(introText.value || (items.map(i=>i.name).join(' vs ')), w/2, 36);
  uCtx.font = '13px sans-serif'; uCtx.textAlign='left';
  uCtx.fillText('Items: '+items.length+'  Landed: '+landingOrder.length, 12, h-12);
}
init();
