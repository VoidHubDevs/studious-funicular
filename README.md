Meme Sound Battle — Multi-file package

Files:
- index.html
- style.css
- app.js
- mediafire_integration.js
- recorder.js
- footer.json (optional)
- links.json (optional)
- sample_trimmed.mp4 (include your 30-45s clip in root)

How to use:
1. Place all files at the repository root.
2. Add your trimmed sample video named `sample_trimmed.mp4` (or let users upload their own).
3. Push to GitHub and connect to Vercel (static deployment enabled). Vercel will serve the files.
4. Open the page. Upload audio files (up to 8) and covers. Use the 'Start Battle', 'Start Recording' buttons.
5. Recording captures the composed canvas visuals + audio graph. Press Download to save the file locally.
6. To enable MediaFire auto-upload, implement server-side code and replace `mediafire_integration.js` with real logic (do NOT embed API keys client-side).
7. For MP4 output compatibility, browser must support recording MP4; fallback to WebM is used if unavailable.

Notes:
- Native SpeechSynthesis (browser voices) can preview the intro; not all browsers capture native TTS into MediaRecorder. Use "Robotic voice" for guaranteed recorded intro.
- You can adjust the funnel style and animation by editing `app.js` functions.
- If you want me to inline additional built-in meme audio (base64) into app.js so everything works offline, tell me and I’ll provide the base64 embedded sounds (file size increases).
