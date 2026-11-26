import { useState, useRef, useEffect } from 'react';
import { useEditor, totalDuration, evalProps } from '../store/editor.js';
import { api } from '../services/api.js';
import { Icon } from '../components/Icon.jsx';

const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const CAPTION_STYLES = [
  {
    id: 'karaoke',
    name: '🎤 Karaoke Pop',
    desc: 'CapCut / Reels style (Yellow Box, Bold)',
    props: {
      fontFamily: 'Anton, sans-serif',
      fontSize: 6.5,
      color: '#000000',
      bg: '#ffe600',
      bgRadius: 8,
      bgPadding: '0.25em 0.65em',
      bold: true,
      stylePreset: 'hook',
      anim: 'pop',
    },
  },
  {
    id: 'neon',
    name: '🔥 Neon Glow',
    desc: 'Glowing Electric Cyan (Night & EDM)',
    props: {
      fontFamily: '"Rozha One", serif',
      fontSize: 7,
      color: '#00f0ff',
      glow: 14,
      glowColor: '#00f0ff',
      bold: true,
      stylePreset: 'neon',
      anim: 'zoom',
    },
  },
  {
    id: 'gold',
    name: '👑 Royal Gold',
    desc: 'Metallic Gold (Wedding & Shayari)',
    props: {
      fontFamily: '"Yatra One", cursive',
      fontSize: 7.5,
      color: '#ffd700',
      bold: true,
      stylePreset: 'gold',
      anim: 'fade',
    },
  },
  {
    id: 'cinematic',
    name: '🎬 Cinematic',
    desc: 'Netflix Subtitle (Dark Translucent Pill)',
    props: {
      fontFamily: 'Poppins, sans-serif',
      fontSize: 5,
      color: '#ffffff',
      bg: 'rgba(10, 15, 25, 0.85)',
      bgRadius: 6,
      bgPadding: '0.25em 0.7em',
      bold: false,
      stylePreset: 'subtitles',
      anim: 'fade',
    },
  },
  {
    id: 'fire',
    name: '💥 Fire Beat',
    desc: 'High energy beat drops & viral shorts',
    props: {
      fontFamily: 'Anton, sans-serif',
      fontSize: 7,
      color: '#ffffff',
      stroke: 2,
      strokeColor: '#000000',
      bold: true,
      stylePreset: 'fire',
      anim: 'pop',
    },
  },
];

const SONG_PRESETS = [
  {
    category: '❤️ Romantic & Bollywood',
    items: [
      {
        title: 'तू है तो मुझे फिर और क्या चाहिए',
        lyrics: `तू है तो मुझे फिर और क्या चाहिए ❤️
किसी से ना कोई शिकायत है मुझे ✨
तेरा हाथ जो थाम लिया मैंने 💖
अब हर खुशी मिल गई मुझे 🌟`,
      },
      {
        title: 'केसरिया तेरा इश्क है पिया',
        lyrics: `केसरिया तेरा इश्क है पिया 🎶
रंग जाऊं जो मैं हाथ लगाऊं ❤️
दिन बीते सारा तेरी फिक्र में ✨
रैन सारी तेरी खैर मनाऊं 🌙`,
      },
      {
        title: 'तेरे वास्ते फलक से मैं चांद लाऊंगा',
        lyrics: `तेरे वास्ते फलक से मैं चांद लाऊंगा 🌙
सोलह सत्रह सितारे संग बांध लाऊंगा ✨
चांद तारे तोड़ लाऊं तेरे वास्ते ❤️
तेरी खातिर सारी दुनिया से लड़ जाऊंगा 🌟`,
      },
      {
        title: 'अपना बना ले पिया दिल के नगर में',
        lyrics: `अपना बना ले पिया दिल के नगर में 💖
रहने दे अपने ही साए में सनम ✨
तू ही मेरी मंजिल तू ही सहारा 🌟
तेरे बिना सूना है जीवन हमारा ❤️`,
      },
    ],
  },
  {
    category: '⚡ Viral Reels & Hooks',
    items: [
      {
        title: 'Wait for the twist 😱',
        lyrics: `Wait for the twist at the end 😱
This will completely shock you! 🔥
Did you see that coming? 👀
Drop your thoughts in comments! 💬`,
      },
      {
        title: '3 Life hacks you must know 💥',
        lyrics: `3 Life hacks that will blow your mind 💥
Number 2 is pure genius ✨
Save this reel right now 📌
Follow for more daily tips! 🚀`,
      },
      {
        title: 'Sach sunke hosh ud jayenge 🔥',
        lyrics: `Sach sunke hosh ud jayenge 🔥
End tak zaroor dekhna 😱
Share with your best friend ❤️
Like and Subscribe 🔔`,
      },
    ],
  },
  {
    category: '🙏 Bhakti & Blessings',
    items: [
      {
        title: 'श्री गणेशाय नमः 🙏',
        lyrics: `श्री गणेशाय नमः 🙏
सबका मंगल हो 🌸
सुख समृद्धि बनी रहे ✨
जय विघ्नहर्ता देवा 🚩`,
      },
      {
        title: 'हर हर महादेव 🔱',
        lyrics: `हर हर महादेव 🔱
ॐ नमः शिवाय 🌸
महाकाल की कृपा आप सब पर बनी रहे 🙏
सत्यम शिवम सुंदरम 🕉️`,
      },
    ],
  },
];

export default function AutoCaptions({ projectId, onClose }) {
  const {
    clips,
    media,
    tracks,
    playhead,
    addCaptions,
    clearCaptions,
    updateCaptionsStyle,
    seek,
    select,
    toggleTrack,
    updateProps,
  } = useEditor();

  const [mode, setMode] = useState('lyrics'); // 'lyrics' | 'speech' | 'ai'
  const [lang, setLang] = useState('hi'); // 'hi' | 'en' | 'hinglish'
  const [selectedStyle, setSelectedStyle] = useState('karaoke');
  const [sourceTrack, setSourceTrack] = useState('VIDEO'); // 'VIDEO' | 'AUDIO'
  const [customLyrics, setCustomLyrics] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [presetCat, setPresetCat] = useState(0);

  // Live Speech Recognition state
  const [isRecording, setIsRecording] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const recognitionRef = useRef(null);
  const speechStartRef = useRef(0);

  const captionClips = clips.filter((c) => c.isCaption);
  const activeStyle = CAPTION_STYLES.find((s) => s.id === selectedStyle) || CAPTION_STYLES[0];

  // Initialize SpeechRecognition if available
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.continuous = true;
      recog.interimResults = true;
      recog.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';

      recog.onstart = () => {
        setIsRecording(true);
        speechStartRef.current = useEditor.getState().playhead;
      };

      recog.onresult = (event) => {
        let currentText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            const now = useEditor.getState().playhead;
            const start = speechStartRef.current;
            const dur = Math.max(1.2, now - start);
            speechStartRef.current = now;

            // Add final recognized phrase to timeline
            addCaptions([{ text: transcript.trim(), start, duration: dur }], activeStyle.props);
            setLiveTranscript('');
          } else {
            currentText += transcript;
          }
        }
        setLiveTranscript(currentText);
      };

      recog.onerror = (e) => {
        setIsRecording(false);
        setMsg(`Mic error: ${e.error}`);
      };

      recog.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recog;
    }

    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, [lang, activeStyle]);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is supported in Chrome, Edge, and Android browser.');
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setMsg('');
      recognitionRef.current.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      recognitionRef.current.start();
    }
  };

  // 1-Click apply lyrics
  const handleApplyLyrics = async (lyricsText) => {
    const textToUse = lyricsText || customLyrics;
    if (!textToUse.trim()) {
      setMsg('कृपया गाने के बोल (lyrics) लिखें या चुनें!');
      return;
    }

    setBusy(true);
    setMsg('गाने के साथ सिंक किया जा रहा है...');

    try {
      // Find the source clip
      const sourceClip = clips.find((c) => c.track === sourceTrack) || clips.find((c) => c.track === 'VIDEO');
      const mediaId = sourceClip?.mediaId;

      let res = null;
      if (!String(projectId).startsWith('local-') && mediaId && !String(mediaId).startsWith('loc-m-')) {
        try {
          res = await api('/captions/analyze', {
            method: 'POST',
            body: { mediaId, lyrics: textToUse, lang },
          });
        } catch (err) {
          console.warn('Caption analyze API failed, falling back to local timing:', err);
        }
      }

      if (res?.captions?.length > 0) {
        addCaptions(res.captions, activeStyle.props);
        setMsg(`✅ ${res.captions.length} सबटाइटल गाने के साथ टाइमलाइन पर जुड़ गए!`);
      } else {
        // Fallback local distribution if backend has no file or is offline
        const lines = textToUse
          .split(/\r?\n|।|\||\. /)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        const dur = Math.max(10, totalDuration(clips));
        const segDur = Math.max(2, Math.min(4, dur / lines.length));
        const localCaps = lines.map((text, i) => ({
          text,
          start: +(i * segDur).toFixed(2),
          duration: +(segDur * 0.9).toFixed(2),
        }));
        addCaptions(localCaps, activeStyle.props);
        setMsg(`✅ ${localCaps.length} सबटाइटल टाइमलाइन पर जुड़ गए!`);
      }
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  // Auto-transcribe audio via backend
  const handleAiTranscribe = async () => {
    setBusy(true);
    setMsg('AI ऑडियो को प्रोसेस कर रहा है...');
    try {
      const sourceClip = clips.find((c) => c.track === sourceTrack) || clips.find((c) => c.track === 'VIDEO');
      const res = await api('/captions/analyze', {
        method: 'POST',
        body: { mediaId: sourceClip?.mediaId, lang },
      });

      if (res?.captions?.length > 0) {
        addCaptions(res.captions, activeStyle.props);
        setMsg(`✅ ${res.captions.length} सबटाइटल तैयार हो गए!`);
      } else {
        setMsg('कोई आवाज़ नहीं मिली। आप "सॉन्ग लिरिक्स" या "बोलकर लिखें" का उपयोग कर सकते हैं।');
      }
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tabbody captions-panel">
      {/* Active Captions Banner */}
      {captionClips.length > 0 && (
        <div className="captions-active-box">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <b>✅ {captionClips.length} सबटाइटल एक्टिव हैं</b>
            </span>
            <div className="row" style={{ gap: 4 }}>
              <button
                className="btn sm"
                title={tracks.TEXT.hidden ? 'सबटाइटल दिखाएं' : 'सबटाइटल छुपाएं'}
                onClick={() => toggleTrack('TEXT', 'hidden')}
              >
                {tracks.TEXT.hidden ? '👁️ Show' : '🙈 Hide'}
              </button>
              <button className="btn sm danger" title="सारे सबटाइटल हटाएं" onClick={clearCaptions}>
                🗑️ Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {msg && <div className="captions-msg">{msg}</div>}

      {/* Language Selector */}
      <div className="caption-section">
        <label className="caption-section-title">1. भाषा चुनें (Choose Language):</label>
        <div className="caption-lang-row">
          <button className={`chip ${lang === 'hi' ? 'on' : ''}`} onClick={() => setLang('hi')}>
            🇮🇳 हिंदी (Hindi)
          </button>
          <button className={`chip ${lang === 'en' ? 'on' : ''}`} onClick={() => setLang('en')}>
            🔤 English
          </button>
          <button className={`chip ${lang === 'hinglish' ? 'on' : ''}`} onClick={() => setLang('hinglish')}>
            💬 Hinglish
          </button>
        </div>
      </div>

      {/* Visual FX & Style Selector */}
      <div className="caption-section">
        <label className="caption-section-title">2. टेक्स्ट इफ़ेक्ट & स्टाइल (Visual FX):</label>
        <div className="caption-style-grid">
          {CAPTION_STYLES.map((st) => (
            <div
              key={st.id}
              className={`caption-style-card ${selectedStyle === st.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedStyle(st.id);
                if (captionClips.length > 0) {
                  updateCaptionsStyle(st.props);
                }
              }}
            >
              <div className="st-name">{st.name}</div>
              <div className="st-desc">{st.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Audio Source Selector */}
      <div className="caption-section">
        <label className="caption-section-title">3. ऑडियो स्रोत (Audio Source):</label>
        <div className="row" style={{ gap: 8 }}>
          <button
            className={`chip ${sourceTrack === 'VIDEO' ? 'on' : ''}`}
            onClick={() => setSourceTrack('VIDEO')}
          >
            🎬 Video Speech (वीडियो की आवाज़)
          </button>
          <button
            className={`chip ${sourceTrack === 'AUDIO' ? 'on' : ''}`}
            onClick={() => setSourceTrack('AUDIO')}
          >
            🎵 Song Track (गाना / म्यूजिक)
          </button>
        </div>
      </div>

      {/* Generation Mode Tabs */}
      <div className="caption-section">
        <div className="text-tabs-head">
          <button className={`text-cat-btn ${mode === 'lyrics' ? 'active' : ''}`} onClick={() => setMode('lyrics')}>
            🎵 सॉन्ग लिरिक्स सिंक
          </button>
          <button className={`text-cat-btn ${mode === 'speech' ? 'active' : ''}`} onClick={() => setMode('speech')}>
            🎙️ बोलकर सबटाइटल बनाएं
          </button>
          <button className={`text-cat-btn ${mode === 'ai' ? 'active' : ''}`} onClick={() => setMode('ai')}>
            🤖 AI ऑटो ट्रांसक्राइब
          </button>
        </div>

        {/* MODE 1: SONG LYRICS */}
        {mode === 'lyrics' && (
          <div className="mode-box">
            <div className="caption-presets-box">
              <label className="muted" style={{ fontSize: 11, fontWeight: 'bold' }}>
                ⭐ 1-क्लिक ट्रेंडिंग सॉन्ग्स & रील्स हुक्स (Click any to sync):
              </label>
              <div className="caption-cat-tabs">
                {SONG_PRESETS.map((cat, i) => (
                  <button
                    key={cat.category}
                    className={`btn sm ${presetCat === i ? 'primary' : ''}`}
                    onClick={() => setPresetCat(i)}
                  >
                    {cat.category}
                  </button>
                ))}
              </div>
              <div className="caption-preset-items">
                {SONG_PRESETS[presetCat].items.map((item) => (
                  <div
                    key={item.title}
                    className="preset-item-card"
                    onClick={() => {
                      setCustomLyrics(item.lyrics);
                      handleApplyLyrics(item.lyrics);
                    }}
                  >
                    <div>
                      <b>{item.title}</b>
                      <small className="muted" style={{ display: 'block', whiteSpace: 'pre-line' }}>
                        {item.lyrics.split('\n').slice(0, 2).join(' · ')}...
                      </small>
                    </div>
                    <button className="btn sm primary">+ Apply</button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <label className="muted" style={{ fontSize: 11, fontWeight: 'bold' }}>
                या अपने गाने के बोल यहाँ पेस्ट करें (Custom Lyrics):
              </label>
              <textarea
                rows={4}
                placeholder="यहाँ गाने के बोल लिखें... हर लाइन गाने के साथ ऑटोमैटिक आएगी।"
                value={customLyrics}
                onChange={(e) => setCustomLyrics(e.target.value)}
                style={{ width: '100%', borderRadius: 8, padding: 8, fontSize: 12, marginTop: 4 }}
              />
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => handleApplyLyrics()}
                style={{ width: '100%', marginTop: 6 }}
              >
                {busy ? 'सिंक किया जा रहा है...' : '⚡ गाने के साथ ऑटो-सिंक करें (Sync Captions)'}
              </button>
            </div>
          </div>
        )}

        {/* MODE 2: LIVE SPEECH TO TEXT */}
        {mode === 'speech' && (
          <div className="mode-box" style={{ textAlign: 'center', padding: '16px 8px' }}>
            <p style={{ fontSize: 13, marginBottom: 8 }}>
              माइक बटन दबाएं और जो भी बोलेंगे वह <b>हिंदी</b> या <b>इंग्लिश</b> में टाइमलाइन पर अपने आप लिखता जाएगा!
            </p>
            <button
              className={`btn ${isRecording ? 'danger' : 'primary'}`}
              onClick={toggleMic}
              style={{
                padding: '12px 24px',
                fontSize: 14,
                borderRadius: 99,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {isRecording ? '🔴 रिकॉर्डिंग जारी है... (बोलना बंद करें)' : '🎙️ बोलना शुरू करें (Start Speaking)'}
            </button>
            {liveTranscript && (
              <div className="live-transcript-box">
                <small className="muted">सुनाई दे रहा है:</small>
                <div style={{ fontSize: 14, fontWeight: 'bold', color: '#ffe600' }}>{liveTranscript}</div>
              </div>
            )}
            <small className="muted" style={{ display: 'block', marginTop: 10 }}>
              जैसे ही आप वाक्य पूरा करेंगे, वह ऑटोमैटिक टाइमलाइन पर सेट हो जाएगा।
            </small>
          </div>
        )}

        {/* MODE 3: AI AUTO TRANSCRIBE */}
        {mode === 'ai' && (
          <div className="mode-box" style={{ textAlign: 'center', padding: '16px 8px' }}>
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              वीडियो या ऑडियो फ़ाइल से आवाज़ पहचानकर ऑटोमैटिक सबटाइटल बनाएं।
            </p>
            <button className="btn primary" disabled={busy} onClick={handleAiTranscribe} style={{ padding: '10px 20px' }}>
              {busy ? 'पहचान रहा है...' : '✨ AI से आवाज़ पहचानें (Auto Transcribe)'}
            </button>
          </div>
        )}
      </div>

      {/* Active Captions List & Inline Editor */}
      {captionClips.length > 0 && (
        <div className="caption-section">
          <label className="caption-section-title">सबटाइटल लिस्ट (क्लिक करके टाइमलाइन पर जाएं या एडिट करें):</label>
          <div className="caption-list-scroll">
            {captionClips.map((c, i) => (
              <div
                key={c.id}
                className="caption-row-item"
                onClick={() => {
                  seek(c.start);
                  select(c.id);
                }}
              >
                <span className="caption-time-badge">{mmss(c.start)}</span>
                <input
                  className="caption-text-input"
                  value={c.props.text}
                  onChange={(e) => updateProps(c.id, { text: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  className="btn sm danger"
                  title="हटाएं"
                  onClick={(e) => {
                    e.stopPropagation();
                    useEditor.getState().removeClip(c.id);
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
