import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import emailjs from '@emailjs/browser';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { User, Coins, ShoppingBag, Home, Moon, Sun, PlusCircle, Package, Trash2, Percent, Menu, X, Edit2, Phone, Mail, ExternalLink, Heart, Eye, Lock, CheckCircle, ShieldCheck, ArrowUp, ArrowDown } from 'lucide-react';
import Ad3D from './components/Ad3D';
import './App.css';

// 👇 우리가 만든 AI 엔진 가져오기 (이름 수정됨!)
import { analyzeContent } from './filter.js';

const globalStyles = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 0; }
`;

// 🎨 테마 설정
const themes = {
  light: { bg: '#ffffff', text: '#111111', navBorder: '#e5e5e5', cardBg: '#f9f9f9', cardBorder: '#eeeeee', secondaryText: '#666666', footerBg: '#f1f1f1', highlight: '#FFD700', delete: '#ff4444', sale: '#FF5252', inputBg: '#fff' },
  dark: { bg: '#111111', text: '#ffffff', navBorder: '#333333', cardBg: '#1a1a1a', cardBorder: '#333333', secondaryText: '#aaaaaa', footerBg: '#000000', highlight: '#FFD700', delete: '#ff4444', sale: '#FF5252', inputBg: '#333' },
};

// ✨ [수정] 카테고리 목록 정의
const CATEGORIES = ['가전', '생활', '음식', '패션'];

// 💾 [NEW] 새로고침해도 데이터가 유지되게 하는 함수 (Hook)
const usePersistedState = (key, defaultValue) => {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  });
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);
  return [state, setState];
};

// 🖼️ [NEW] 이미지를 저장 가능한 문자열(Base64)로 변환하는 함수
const convertToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

// 📱 반응형 훅
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  return matches;
};

// 🕒 날짜 헬퍼
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + parseInt(days));
  return result;
};
const getDaysLeft = (expiryDate) => {
  const now = new Date();
  const end = new Date(expiryDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? `D-${diffDays}` : '만료됨';
};
const isExpired = (expiryDate) => new Date(expiryDate) < new Date();

// 🚨 [NEW] 신고하기 모달 창
const ReportModal = ({ isOpen, onClose, onSubmit, theme }) => {
  if (!isOpen) return null;
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!reason.trim()) return alert("신고 사유를 입력해주세요.");
    onSubmit(reason);
    setReason(''); // 초기화
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ background: theme.cardBg, color: theme.text, padding: '25px', borderRadius: '15px', width: '90%', maxWidth: '400px', border: `1px solid ${theme.cardBorder}`, boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
        <h2 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>🚨 신고하기</h2>
        <p style={{ marginBottom: '10px', fontSize: '14px', color: theme.secondaryText }}>부적절한 콘텐츠인가요? 사유를 알려주세요.</p>
        <textarea 
          value={reason} 
          onChange={(e) => setReason(e.target.value)} 
          placeholder="예: 성적인 콘텐츠, 폭력성, 사기 의심 등"
          style={{ width: '100%', height: '100px', padding: '10px', borderRadius: '10px', border: '1px solid #ccc', background: theme.inputBg, color: theme.text, marginBottom: '20px', resize: 'none' }}
        />
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleSubmit} style={{ flex: 1, padding: '12px', background: '#FF5252', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>신고 접수</button>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', background: '#555', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  );
};

// 🛠️ 수정 모달 (변수명 오류 수정 및 AI 필터링 적용)
const EditModal = ({ isOpen, onClose, data, onSave, theme }) => {
  if (!isOpen) return null;
  const [form, setForm] = useState({ ...data });
  const [isScanning, setIsScanning] = useState(false);

  const handleImageChange = async (e, field) => {
    const file = e.target.files[0];
    if (file) {
      const base64 = await convertToBase64(file);
      setForm({ ...form, [field]: base64 });
    }
  };

  // EditModal 컴포넌트 안의 handleSubmit 수정
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsScanning(true);

    // 텍스트 합치기
    const fullText = `${form.name || ''} ${form.title || ''} ${form.company || ''} ${form.url || ''}`;
    
    // 이미지 가져오기 (이미지가 있으면 base64 문자열, 없으면 null)
    const imageToCheck = form.image || form.image3d || null;

    // ✨ AI에게 검사 요청 (함수 이름은 이제 import한 것과 같음)
    const checkResult = await analyzeContent(fullText, imageToCheck);

    setIsScanning(false);

    if (!checkResult.isSafe) {
      alert(`🚨 [AI 차단] 등록할 수 없는 내용입니다.\n사유: ${checkResult.reason}`);
      return;
    }

    onSave({ ...form, price: parseInt(form.price) });
    alert('✅ AI 안전 검사 통과! 저장되었습니다.');
    onClose();
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: theme.bg, color: theme.text, padding: '30px', borderRadius: '15px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '20px', fontSize: '20px', fontWeight: 'bold' }}>정보 수정</h2>
        {isScanning && (
          <div style={{ textAlign: 'center', marginBottom: '10px', padding: '10px', background: 'rgba(255, 215, 0, 0.1)', borderRadius: '10px', color: theme.highlight }}>
            🤖 AI가 수정된 내용을 분석하고 있습니다...
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>제목/상품명</label>
            <input value={form.title || form.name} onChange={(e) => setForm({ ...form, title: e.target.value, name: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', background: theme.inputBg, color: theme.text }} />
          </div>
          {form.category && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>카테고리</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', background: theme.inputBg, color: theme.text }}>
                {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
          )}
          {form.company && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>회사명</label>
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', background: theme.inputBg, color: theme.text }} />
            </div>
          )}
          {form.itemType === 'product' && (
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>가격</label>
              <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) })} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', background: theme.inputBg, color: theme.text }} />
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>연결 URL</label>
            <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', background: theme.inputBg, color: theme.text }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button onClick={handleSubmit} disabled={isScanning} style={{ flex: 1, padding: '15px', background: isScanning ? '#888' : theme.highlight, border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: isScanning ? 'wait' : 'pointer', color: 'black' }}>
            {isScanning ? '🤖 검사 중...' : '저장하기'}
          </button>
          <button onClick={onClose} disabled={isScanning} style={{ flex: 1, padding: '15px', background: '#555', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  );
};

// 🏠 레이아웃 (수정됨: 모바일 여백 최적화)
const Layout = ({ children, isDarkMode, toggleTheme, tokens, isLoggedIn, user, onLogout }) => {
  const theme = isDarkMode ? themes.dark : themes.light;
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setIsMenuOpen(false), [location]);

  return (
    <div style={{ position: 'relative', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {/* 🖼️ 배경 레이어 */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'url("./background_pattern.png")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', filter: isDarkMode ? 'invert(1)' : 'none', zIndex: 0, transition: 'filter 0.3s' }} />

      {/* 📦 컨텐츠 레이어 */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh', color: theme.text, transition: 'color 0.3s' }}>
        <nav style={{ padding: '20px 40px', borderBottom: `1px solid ${theme.navBorder}`, position: 'relative', zIndex: 10, background: theme.bg }}>
           {/* ... (네비게이션 코드는 기존과 동일, 생략해도 됨) ... */}
           {/* 기존 코드 그대로 유지하면 됩니다. 바뀐 건 아래 main 부분뿐이야 */}
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Link to="/" style={{ fontSize: '24px', fontWeight: 'bold', color: theme.highlight, textDecoration: 'none' }}>✨ AD Cube</Link>
            {isMobile ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {isLoggedIn && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: isDarkMode ? '#333' : '#eee', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                    <Coins size={14} color="#FFD700" />
                    <span style={{ color: theme.highlight }}>{tokens.toLocaleString()}</span>
                  </div>
                )}
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ background: 'none', border: 'none', color: theme.text, cursor: 'pointer' }}>
                  {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: theme.text, textDecoration: 'none' }}><Home size={18} /> 광고</Link>
                <Link to="/shop" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: theme.text, textDecoration: 'none' }}><ShoppingBag size={18} /> 쇼핑</Link>
                <Link to="/token" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: theme.text, textDecoration: 'none' }}><Coins size={18} /> 충전소</Link>
                <div style={{ width: '1px', height: '20px', background: theme.navBorder, margin: '0 5px' }}></div>
                <Link to="/register-ad" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: theme.highlight, textDecoration: 'none', fontWeight: 'bold' }}><PlusCircle size={18} /> 광고등록</Link>
                <Link to="/register-product" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: theme.sale, textDecoration: 'none', fontWeight: 'bold' }}><Package size={18} /> 상품등록</Link>
                <div style={{ width: '1px', height: '20px', background: theme.navBorder, margin: '0 5px' }}></div>
                <Link to="/mypage" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: theme.text, textDecoration: 'none' }}><User size={18} /> MY</Link>
                {isLoggedIn ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 15px', background: isDarkMode ? '#333' : '#eee', borderRadius: '20px', fontWeight: 'bold' }}>
                      <Coins size={16} color="#FFD700" />
                      <span style={{ color: theme.highlight }}>{tokens.toLocaleString()} T</span>
                    </div>
                    <button onClick={onLogout} style={{ background: 'none', border: 'none', color: theme.secondaryText, cursor: 'pointer', fontWeight: 'bold' }}>로그아웃</button>
                  </>
                ) : (
                  <Link to="/login" style={{ padding: '8px 20px', background: theme.highlight, color: 'black', borderRadius: '20px', textDecoration: 'none', fontWeight: 'bold' }}>로그인</Link>
                )}
                <button onClick={toggleTheme} style={{ background: 'none', border: `1px solid ${theme.navBorder}`, borderRadius: '50%', padding: '8px', cursor: 'pointer', color: theme.text, display: 'flex', alignItems: 'center' }}>
                  {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>
              </div>
            )}
          </div>
          {/* 모바일 메뉴 */}
          {isMobile && isMenuOpen && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: theme.bg, borderBottom: `1px solid ${theme.navBorder}`, padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', boxShadow: '0 10px 20px rgba(0,0,0,0.2)', zIndex: 20, alignItems: 'center', textAlign: 'center' }}>
              <Link to="/" style={{ color: theme.text, textDecoration: 'none', fontSize: '18px', fontWeight: 'bold', width: '100%' }}>🏠 광고 갤러리</Link>
              <Link to="/shop" style={{ color: theme.text, textDecoration: 'none', fontSize: '18px', fontWeight: 'bold', width: '100%' }}>🛍️ 쇼핑 센터</Link>
              <Link to="/token" style={{ color: theme.text, textDecoration: 'none', fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%' }}><Coins size={20} color="#00ccff" /> 토큰 충전소</Link>
              <Link to="/mypage" style={{ color: theme.text, textDecoration: 'none', fontSize: '18px', fontWeight: 'bold', width: '100%' }}>👤 마이 페이지</Link>
              <div style={{ borderTop: `1px solid ${theme.navBorder}`, margin: '5px 0', width: '100%' }}></div>
              <Link to="/register-ad" style={{ color: theme.highlight, textDecoration: 'none', fontSize: '18px', fontWeight: 'bold', width: '100%' }}>📢 광고 등록하기</Link>
              <Link to="/register-product" style={{ color: theme.sale, textDecoration: 'none', fontSize: '18px', fontWeight: 'bold', width: '100%' }}>📦 상품 등록하기</Link>
              <div style={{ borderTop: `1px solid ${theme.navBorder}`, margin: '5px 0', width: '100%' }}></div>
              {isLoggedIn ? (
                <button onClick={onLogout} style={{ textAlign: 'center', background: 'none', border: 'none', color: theme.delete, fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>로그아웃</button>
              ) : (
                <Link to="/login" style={{ color: theme.highlight, textDecoration: 'none', fontSize: '18px', fontWeight: 'bold', width: '100%' }}>🔑 로그인 하러가기</Link>
              )}
              <div style={{ borderTop: `1px solid ${theme.navBorder}`, paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ color: theme.text }}>다크 모드</span>
                <button onClick={toggleTheme} style={{ background: 'none', border: `1px solid ${theme.navBorder}`, borderRadius: '50%', padding: '8px', cursor: 'pointer', color: theme.text }}>{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
              </div>
            </div>
          )}
        </nav>
        
        {/* ✨ 여기가 수정됨: 모바일일 때 패딩을 10px로 줄임 */}
        <main style={{ flex: 1, width: '100%', position: 'relative', zIndex: 1 }}>{children}</main>
        
        <footer style={{ padding: '40px', backgroundColor: theme.footerBg, color: theme.secondaryText, fontSize: '12px', textAlign: 'center', borderTop: `1px solid ${theme.navBorder}` }}>
          <p>Copyright © 2026 Gaeul Corp.</p>
        </footer>
      </div>
    </div>
  );
};

// 🔐 로그인 페이지 (수정됨: 아이디 저장 기능 추가)
const LoginPage = ({ isDarkMode, onLogin }) => {
  const theme = isDarkMode ? themes.dark : themes.light;
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const fileInputRef3d = useRef(null);
  const [form, setForm] = useState({ email: '', password: '' });
  
  // ✨ [추가] 아이디 저장 체크 상태
  const [rememberId, setRememberId] = useState(false);

  // ✨ [추가] 페이지 로드 시 저장된 아이디 불러오기
  useEffect(() => {
    const savedEmail = localStorage.getItem('savedEmail');
    if (savedEmail) {
      setForm(prev => ({ ...prev, email: savedEmail }));
      setRememberId(true);
    }

    // 이메일 인증 후 돌아왔을 때 처리
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
        alert("🎉 이메일 인증이 완료되었습니다!\n이제 로그인을 진행해주세요.");
        window.history.replaceState(null, '', '/login');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (error) {
        alert('아이디 또는 비밀번호를 확인해주세요.');
        return; 
      }

      if (data.user) {
        // ✨ [추가] 로그인 성공 시 아이디 저장/삭제 처리
        if (rememberId) {
          localStorage.setItem('savedEmail', form.email);
        } else {
          localStorage.removeItem('savedEmail');
        }

        onLogin(data.user.email); 
        navigate('/');
      }
    } catch (error) {
      alert('시스템 오류가 발생했습니다.');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', textAlign: 'center' }}>
      <h1 style={{ marginBottom: '30px' }}>로그인</h1>
      <form onSubmit={handleSubmit} style={{ background: theme.cardBg, padding: '30px', borderRadius: '15px', border: `1px solid ${theme.cardBorder}` }}>
        <div style={{ marginBottom: '15px', textAlign: 'left' }}>
           <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>이메일</label>
           <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: theme.inputBg, color: theme.text }} />
        </div>
        <div style={{ marginBottom: '15px', textAlign: 'left' }}>
           <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>비밀번호</label>
           <input type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: theme.inputBg, color: theme.text }} />
        </div>
        
        {/* ✨ [추가] 아이디 저장 체크박스 */}
        <div style={{ marginBottom: '20px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input 
            type="checkbox" 
            id="rememberId" 
            checked={rememberId} 
            onChange={(e) => setRememberId(e.target.checked)} 
            style={{ width: '16px', height: '16px', cursor: 'pointer' }} 
          />
          <label htmlFor="rememberId" style={{ cursor: 'pointer', fontSize: '14px', color: theme.secondaryText }}>아이디 저장</label>
        </div>

        <button type="submit" style={{ width: '100%', padding: '15px', borderRadius: '10px', border: 'none', background: theme.highlight, color: 'black', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px' }}>로그인</button>
        <div style={{ fontSize: '14px', color: theme.secondaryText }}>
          <Link to="/signup" style={{ color: theme.highlight, fontWeight: 'bold', textDecoration: 'none' }}>회원가입</Link>
        </div>
      </form>
    </div>
  );
};

// src/App.jsx 파일 안에서 아래 컴포넌트를 찾아서 통째로 교체해줘!

// 📝 회원가입 페이지 (수정됨: 닉네임 중복 확인 + AI 검사)
const SignUpPage = ({ isDarkMode }) => {
  const theme = isDarkMode ? themes.dark : themes.light;
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [isScanning, setIsScanning] = useState(false);
  
  const isPasswordMismatch = form.password && form.confirmPassword && form.password !== form.confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name || !form.email || !form.password) return alert('모든 정보를 입력해주세요.');
    if (isPasswordMismatch) return alert('비밀번호가 일치하지 않습니다.');
    
    setIsScanning(true); 

    try {
      // 1. ✨ [NEW] 닉네임 중복 확인 (DB 조회)
      // profiles 테이블에서 똑같은 name이 있는지 찾아본다.
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('name')
        .eq('name', form.name)
        .maybeSingle(); // 있으면 데이터 반환, 없으면 null

      if (existingUser) {
        setIsScanning(false);
        alert(`🚨 이미 사용 중인 닉네임입니다.\n다른 닉네임을 입력해주세요.`);
        return; 
      }

      // 2. AI 닉네임 유해성 검사
      const checkResult = await analyzeContent(form.name, null, 'profile');

      if (!checkResult.isSafe) {
        setIsScanning(false);
        alert(`🚨 사용 불가능한 닉네임입니다.\n사유: ${checkResult.reason}`);
        return; 
      }

      // 3. Supabase Auth 가입 요청
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });
    
      if (error) throw error;
    
      // 4. 닉네임 저장
      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: data.user.id,
              email: form.email,
              name: form.name,
              tokens: 0 
            }
          ]);
    
        if (profileError) {
            console.error("프로필 생성 실패:", profileError);
        }
    
        alert(`🎉 가입 신청 완료!\n[${form.email}]로 인증 메일을 보냈습니다.\n메일함에서 링크를 클릭하면 로그인이 가능합니다.`);
        navigate('/login');
      }
    } catch (error) {
      alert(`가입 실패: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>회원가입</h1>
      <form onSubmit={handleSubmit} style={{ background: theme.cardBg, padding: '30px', borderRadius: '15px', border: `1px solid ${theme.cardBorder}` }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>닉네임</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: theme.inputBg, color: theme.text }} placeholder="사용할 닉네임" />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>이메일</label>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: theme.inputBg, color: theme.text }} placeholder="실제 사용 중인 이메일" />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>비밀번호</label>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: theme.inputBg, color: theme.text }} placeholder="비밀번호" />
        </div>
        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>비밀번호 확인</label>
          <input 
            type="password" 
            value={form.confirmPassword} 
            onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} 
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: isPasswordMismatch ? '2px solid #FF5252' : 'none', background: theme.inputBg, color: theme.text }} 
            placeholder="비밀번호 재입력" 
          />
          {isPasswordMismatch && <div style={{ color: '#FF5252', fontSize: '12px', marginTop: '5px', fontWeight: 'bold' }}>🚨 비밀번호가 서로 다릅니다!</div>}
        </div>
        <button type="submit" disabled={isScanning} style={{ width: '100%', padding: '15px', borderRadius: '10px', border: 'none', background: isScanning ? '#888' : theme.highlight, color: isScanning ? 'white' : 'black', fontWeight: 'bold', cursor: isScanning ? 'wait' : 'pointer' }}>
          {isScanning ? '🤖 검사 중...' : '가입하기'}
        </button>
      </form>
    </div>
  );
};

const btnStyle = { padding: '8px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s', fontSize: '14px' };

// 📺 광고 페이지 (수정됨: onReport 기능 수신 + 버튼 클릭감 추가)
const AdPage = ({ isDarkMode, adList, onAdClick, onReport }) => { // 👈 ✨ 여기에 onReport가 꼭 있어야 해!
  const theme = isDarkMode ? themes.dark : themes.light;
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [filter, setFilter] = useState('default');
  const [sortOrder, setSortOrder] = useState('desc');
  const activeAds = adList.filter((ad) => !isExpired(ad.expiryDate));

  const getSortedAds = () => {
    let sorted = [...activeAds];
    if (filter === 'views') sorted.sort((a, b) => b.views - a.views);
    else if (filter === 'latest') sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    else sorted.sort((a, b) => (a.type === b.type ? 0 : a.type === 'premium' ? -1 : 1));
    if (sortOrder === 'asc') sorted.reverse();
    return sorted;
  };
  const sortedData = getSortedAds();
  const kioskData = {
    side1: sortedData.filter((ad) => ad.type === 'premium').map((ad) => ({ title: ad.title, image: ad.image, image3d: ad.image3d, fitMode3d: ad.fitMode3d })),
    side3: sortedData.filter((ad) => ad.type === 'premium').map((ad) => ({ title: ad.title, image: ad.image, image3d: ad.image3d, fitMode3d: ad.fitMode3d })),
    side2: sortedData.filter((ad) => ad.type === 'normal').map((ad) => ({ title: ad.title, image: ad.image, image3d: ad.image3d, fitMode3d: ad.fitMode3d })),
    side4: sortedData.filter((ad) => ad.type === 'normal').map((ad) => ({ title: ad.title, image: ad.image, image3d: ad.image3d, fitMode3d: ad.fitMode3d })),
  };

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', padding: isMobile ? '10px' : '40px' }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', marginBottom: '20px', gap: '15px' }}>
        <h1 style={{ fontSize: isMobile ? '24px' : '32px' }}>광고 갤러리 🎨</h1>
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', width: '100%', paddingBottom: '5px', alignItems: 'center' }}>
          {['default', 'latest', 'views'].map((type) => (
            <button key={type} onClick={() => setFilter(type)} style={{ ...btnStyle, whiteSpace: 'nowrap', background: filter === type ? theme.highlight : theme.cardBorder, color: filter === type ? 'black' : theme.text }}>
              {type === 'default' ? '기본' : type === 'latest' ? '최신순' : '조회수순'}
            </button>
          ))}
          <button onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))} style={{ ...btnStyle, background: theme.cardBorder, color: theme.text }}>{sortOrder === 'desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}</button>
        </div>
      </div>
      <Ad3D isDarkMode={isDarkMode} items={kioskData} mode="AD" isMobile={isMobile} />
      <div style={{ marginTop: '40px' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '20px', paddingBottom: '10px' }}>👇 진행중인 광고</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr', gap: '15px' }}>
          {sortedData.map((ad) => (
            <div key={ad.id} onClick={() => { onAdClick(ad.id); window.open(ad.url, '_blank'); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px', background: ad.type === 'premium' ? (isDarkMode ? 'linear-gradient(90deg, #332b00 0%, #111 100%)' : 'linear-gradient(90deg, #fffbeb 0%, #fff 100%)') : theme.cardBg, border: ad.type === 'premium' ? `1px solid ${theme.highlight}` : `1px solid ${theme.cardBorder}`, borderRadius: '10px', cursor: 'pointer', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {ad.image && <img src={ad.image} alt="ad" style={{ width: '50px', height: '50px', objectFit: ad.fitMode || 'cover', borderRadius: '8px' }} />}
                <div>
                  {ad.type === 'premium' && <span style={{ background: theme.highlight, color: 'black', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', marginRight: '5px' }}>PREMIUM</span>}
                  <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{ad.title}</span> <ExternalLink size={12} color={theme.secondaryText} style={{ marginLeft: '5px' }} />
                  <p style={{ color: theme.secondaryText, fontSize: '12px', marginTop: '2px' }}>{ad.company} | {new Date(ad.date).toLocaleDateString()} ~ {new Date(ad.expiryDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: theme.secondaryText, fontSize: '12px' }}>👁️ {ad.views}</span>
                {/* ✨ 신고 버튼 (z-index 추가로 클릭 확실하게) */}
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    console.log("🚨 광고 신고 클릭됨:", ad.id); 
                    onReport(ad.id, 'ad'); 
                  }} 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', zIndex: 10, position: 'relative' }}
                  title="이 광고 신고하기"
                >
                  🚨
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 🛍️ 쇼핑 페이지 (수정됨: onReport 기능 수신 + 버튼 클릭감 추가)
const ShopPage = ({ isDarkMode, productList, onToggleLike, onProductClick, onReport }) => { // 👈 ✨ 여기에 onReport 추가!
  const theme = isDarkMode ? themes.dark : themes.light;
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortFilter, setSortFilter] = useState('default');
  const [sortOrder, setSortOrder] = useState('desc');
  const [priceRange, setPriceRange] = useState({ min: 0, max: 5000000 });
  const activeProducts = productList.filter((p) => !isExpired(p.expiryDate));

  const getProcessedProducts = () => {
    let result = categoryFilter === 'ALL' ? [...activeProducts] : activeProducts.filter((p) => p.category === categoryFilter);
    result = result.filter((p) => { const price = p.discountPrice || p.price; return price >= priceRange.min && price <= priceRange.max; });
    if (sortFilter === 'lowPrice') result.sort((a, b) => (a.discountPrice || a.price) - (b.discountPrice || b.price));
    else if (sortFilter === 'highPrice') result.sort((a, b) => (b.discountPrice || b.price) - (a.discountPrice || a.price));
    else if (sortFilter === 'likes') result.sort((a, b) => b.likes - a.likes);
    else if (sortFilter === 'views') result.sort((a, b) => b.views - a.views);
    else if (sortFilter === 'latest') result.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (sortOrder === 'asc') result.reverse();
    return result;
  };

  const getTagColor = (tag) => {
    switch (tag) { case 'HOT': return '#FF4500'; case 'NEW': return '#2ECC71'; case 'SALE': return '#D4AC0D'; default: return '#888'; }
  };
  const sortedData = getProcessedProducts();
  const kioskData = {
    top: activeProducts.filter((p) => p.calculatedTag === 'HOT').map((p) => ({ title: p.name, image: p.image3d || p.image, fitMode3d: p.fitMode3d })),
    side1: { title: '가전', items: activeProducts.filter((p) => p.category === '가전').map((p) => ({ title: p.name, image: p.image3d || p.image, fitMode3d: p.fitMode3d })) },
    side2: { title: '생활', items: activeProducts.filter((p) => p.category === '생활').map((p) => ({ title: p.name, image: p.image3d || p.image, fitMode3d: p.fitMode3d })) },
    side3: { title: '음식', items: activeProducts.filter((p) => p.category === '음식').map((p) => ({ title: p.name, image: p.image3d || p.image, fitMode3d: p.fitMode3d })) },
    side4: { title: '패션', items: activeProducts.filter((p) => p.category === '패션').map((p) => ({ title: p.name, image: p.image3d || p.image, fitMode3d: p.fitMode3d })) },
  };

  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', padding: isMobile ? '10px' : '40px' }}>
      <h1 style={{ fontSize: isMobile ? '24px' : '32px', marginBottom: '20px' }}>쇼핑 센터 🛍️</h1>
      <div style={{ marginBottom: '20px', padding: '20px', background: theme.cardBg, borderRadius: '15px', border: `1px solid ${theme.cardBorder}` }}>
        <div style={{ marginBottom: '15px', display: 'flex', gap: '10px', overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '5px' }}>
          {['ALL', ...CATEGORIES].map((cat) => (
            <button key={cat} onClick={() => setCategoryFilter(cat)} style={{ ...btnStyle, background: categoryFilter === cat ? theme.highlight : theme.bg, color: categoryFilter === cat ? 'black' : theme.text }}>{cat}</button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Price:</span>
            <input type="number" placeholder="0" value={priceRange.min} onChange={(e) => setPriceRange({ ...priceRange, min: Number(e.target.value) })} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', width: '80px' }} />
            <span>~</span>
            <input type="number" placeholder="Max" value={priceRange.max} onChange={(e) => setPriceRange({ ...priceRange, max: Number(e.target.value) })} style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', width: '80px' }} />
          </div>
          <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '5px', alignItems: 'center' }}>
            {['default', 'latest', 'lowPrice', 'highPrice', 'likes', 'views'].map((sort) => (
              <button key={sort} onClick={() => setSortFilter(sort)} style={{ ...btnStyle, fontSize: '12px', whiteSpace: 'nowrap', background: sortFilter === sort ? theme.highlight : theme.bg, color: sortFilter === sort ? 'black' : theme.text }}>
                {sort === 'default' ? '기본' : sort === 'latest' ? '최신순' : sort === 'lowPrice' ? '저가순' : sort === 'highPrice' ? '고가순' : sort === 'likes' ? '찜순' : '조회수'}
              </button>
            ))}
            <button onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))} style={{ ...btnStyle, background: theme.cardBorder, color: theme.text }}>{sortOrder === 'desc' ? <ArrowDown size={16} /> : <ArrowUp size={16} />}</button>
          </div>
        </div>
      </div>
      <Ad3D isDarkMode={isDarkMode} items={kioskData} mode="SHOP" isMobile={isMobile} />
      <div style={{ marginTop: '40px' }}>
        <h2 style={{ fontSize: '24px', marginBottom: '20px', paddingBottom: '10px' }}>👇 목록</h2>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: isMobile ? '10px' : '20px' }}>
          {sortedData.map((item) => (
            <div key={item.id} onClick={() => { onProductClick(item.id); window.open(item.url, '_blank'); }} style={{ padding: '15px', background: theme.cardBg, border: 'none', borderRadius: '10px', textAlign: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}>
              
              {/* ✨ 신고 버튼 (우측 상단, z-index 강화) */}
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  console.log("🚨 상품 신고 클릭됨:", item.id); 
                  onReport(item.id, 'product'); 
                }}
                style={{ position: 'absolute', top: '5px', right: '5px', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', zIndex: 20 }}
                title="이 상품 신고하기"
              >
                🚨
              </button>

              <div style={{ width: '100%', height: isMobile ? '100px' : '150px', background: item.image ? 'transparent' : '#ddd', borderRadius: '10px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {item.image ? <img src={item.image} alt="p" style={{ width: '100%', height: '100%', objectFit: item.fitMode || 'cover' }} /> : <Package size={30} color="#888" />}
              </div>
              {item.calculatedTag && <div style={{ background: getTagColor(item.calculatedTag), color: 'white', width: 'fit-content', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold', margin: '0 auto 5px auto' }}>{item.calculatedTag}</div>}
              <h3 style={{ fontSize: isMobile ? '14px' : '16px', marginBottom: '5px', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</h3>
              <p style={{ fontSize: '11px', color: theme.secondaryText, marginBottom: '5px' }}>{new Date(item.date).toLocaleDateString()} ~ {new Date(item.expiryDate).toLocaleDateString()}</p>
              {item.discountPrice ? (
                <div>
                  <span style={{ textDecoration: 'line-through', color: theme.secondaryText, fontSize: '12px', marginRight: '5px' }}>{item.price.toLocaleString()}</span>
                  <span style={{ color: theme.sale, fontWeight: 'bold', fontSize: '12px' }}>{Math.round((1 - item.discountPrice / item.price) * 100)}%</span>
                  <div style={{ fontWeight: 'bold', color: theme.sale, fontSize: isMobile ? '16px' : '20px' }}>{item.discountPrice.toLocaleString()}원</div>
                </div>
              ) : (
                <p style={{ fontWeight: 'bold', color: theme.text, fontSize: isMobile ? '14px' : '18px' }}>{item.price.toLocaleString()}원</p>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '10px', fontSize: '12px', color: theme.secondaryText }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Eye size={14} /> {item.views}</span>
                <button onClick={(e) => { e.stopPropagation(); onToggleLike(item.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', color: item.isLiked ? '#FF5252' : theme.secondaryText }}>
                  <Heart size={14} fill={item.isLiked ? '#FF5252' : 'none'} /> {item.likes}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const durationOptions = [
  { days: 1, label: '1일 (500T)', cost: 500 },
  { days: 3, label: '3일 (1,200T)', cost: 1200 },
  { days: 7, label: '7일 (2,500T)', cost: 2500 },
  { days: 30, label: '30일 (9,000T)', cost: 9000 },
];

// 📺 광고 등록 페이지 (AI 차단 강화 & 코드 정리)
const RegisterAdPage = ({ isDarkMode, tokens, onRegister, onBan }) => {
  // ✨ [추가] 이미지 제거 함수
  const handleRemoveImage = (type) => {
    setFormData({ ...formData, [type]: null });
    if (type === 'image' && fileInputRef.current) fileInputRef.current.value = '';
    if (type === 'image3d' && fileInputRef3d.current) fileInputRef3d.current.value = '';
  };
  const theme = isDarkMode ? themes.dark : themes.light;
  const navigate = useNavigate();
  // ✨ [추가 1] 파일 입력창을 조종할 리모컨(ref) 생성
  const fileInputRef = useRef(null);
  const fileInputRef3d = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [formData, setFormData] = useState({ title: '', company: '', url: 'https://', type: 'normal', image: null, image3d: null, duration: 1, fitMode: 'cover', fitMode3d: 'cover' });
  const typeCost = formData.type === 'premium' ? 5000 : 1000;
  const durationCost = durationOptions.find((d) => d.days === parseInt(formData.duration))?.cost || 0;
  const totalCost = typeCost + durationCost;
  const canAfford = tokens >= totalCost;

  const handleImageChange = async (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const base64 = await convertToBase64(file);
      setFormData({ ...formData, [type]: base64 });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canAfford) { alert('토큰 부족!'); return; }
    
    setIsScanning(true);

    const fullText = `${formData.title} ${formData.company} ${formData.url}`;
    
    // ✨ AI 검사 (텍스트 + 이미지)
    const checkResult = await analyzeContent(fullText, formData.image);

    setIsScanning(false);

    if (!checkResult.isSafe) {
       alert(`🚨 [AI 차단] 유해한 콘텐츠가 감지되었습니다.\n사유: ${checkResult.reason}`);
       return; 
    }

    onRegister({ ...formData, price: totalCost });
    alert('✅ AI 안전 검사 통과! 광고가 등록되었습니다.');
    navigate('/');
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '20px', textAlign: 'center' }}>광고 등록</h1>
      {isScanning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <ShieldCheck size={60} color="#2ECC71" style={{ marginBottom: '20px' }} />
          <h2>🤖 AI 클린봇 정밀 검사 중...</h2>
          <p>이미지와 텍스트를 분석하고 있습니다.</p>
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ background: theme.cardBg, padding: '20px', borderRadius: '20px', border: `1px solid ${theme.cardBorder}` }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>제목</label>
          <input type="text" required value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: theme.inputBg, color: theme.text }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>회사명</label>
          <input type="text" required value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: theme.inputBg, color: theme.text }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>연결 URL</label>
          <input type="url" required value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: theme.inputBg, color: theme.text }} />
        </div>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
          
          {/* 1. 썸네일 이미지 + 삭제 버튼 */}
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>썸네일</label>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={(e) => handleImageChange(e, 'image')} style={{ color: theme.secondaryText, width: '100%', fontSize: '12px' }} />
            <select value={formData.fitMode} onChange={(e) => setFormData({ ...formData, fitMode: e.target.value })} style={{ marginTop: '5px', padding: '5px', borderRadius: '5px', background: theme.inputBg, color: theme.text }}>
              <option value="cover">꽉 채우기</option> <option value="contain">다 보이기</option>
            </select>
            
            {/* 이미지가 있을 때만 보임 */}
            {formData.image && (
              <div style={{ position: 'relative', marginTop: '5px', width: '100%', height: '80px' }}>
                <img src={formData.image} alt="preview" style={{ width: '100%', height: '100%', objectFit: formData.fitMode, borderRadius: '5px', border: '1px solid #ddd' }} />
                <button 
                  type="button" 
                  onClick={() => handleRemoveImage('image')}
                  style={{ 
                    position: 'absolute', 
                    top: '5px',       
                    right: '5px',     
                    zIndex: 100,       // ✨ 맨 위로 오게 설정
                    background: 'rgba(255, 0, 0, 0.8)', // 빨간색 배경
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '50%', 
                    width: '24px', 
                    height: '24px', 
                    cursor: 'pointer', 
                    fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                  X
                </button>
              </div>
            )}
          </div>

          {/* 2. 3D 매대용 이미지 + 삭제 버튼 */}
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>3D 매대용</label>
            <input type="file" accept="image/*" ref={fileInputRef3d} onChange={(e) => handleImageChange(e, 'image3d')} style={{ color: theme.secondaryText, width: '100%', fontSize: '12px' }} />
            <select value={formData.fitMode3d} onChange={(e) => setFormData({ ...formData, fitMode3d: e.target.value })} style={{ marginTop: '5px', padding: '5px', borderRadius: '5px', background: theme.inputBg, color: theme.text }}>
              <option value="cover">꽉 채우기</option> <option value="contain">다 보이기</option>
            </select>
            
            {formData.image3d && (
              <div style={{ position: 'relative', marginTop: '5px', width: '100%', height: '80px' }}>
                <img src={formData.image3d} alt="preview" style={{ width: '100%', height: '100%', objectFit: formData.fitMode3d, borderRadius: '5px', border: '1px solid #ddd' }} />
                <button 
                  type="button"
                  onClick={() => handleRemoveImage('image3d')}
                  style={{ 
                    position: 'absolute', 
                    top: '5px', 
                    right: '5px', 
                    zIndex: 100,
                    background: 'rgba(255, 0, 0, 0.8)',
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '50%', 
                    width: '24px', 
                    height: '24px', 
                    cursor: 'pointer', 
                    fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                  X
                </button>
              </div>
            )}
          </div>
        </div>
        <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
          <label style={{ flex: 1, padding: '10px', border: formData.type === 'normal' ? `2px solid ${theme.highlight}` : '1px solid gray', borderRadius: '10px', textAlign: 'center', cursor: 'pointer' }}>
            <input type="radio" name="t" value="normal" checked={formData.type === 'normal'} onChange={() => setFormData({ ...formData, type: 'normal' })} style={{ display: 'none' }} /> 일반
          </label>
          <label style={{ flex: 1, padding: '10px', border: formData.type === 'premium' ? `2px solid ${theme.highlight}` : '1px solid gray', borderRadius: '10px', textAlign: 'center', cursor: 'pointer' }}>
            <input type="radio" name="t" value="premium" checked={formData.type === 'premium'} onChange={() => setFormData({ ...formData, type: 'premium' })} style={{ display: 'none' }} /> 프리미엄
          </label>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>게시 기간</label>
          <select value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: theme.inputBg, color: theme.text }}>
            {durationOptions.map((opt) => (<option key={opt.days} value={opt.days}>{opt.label}</option>))}
          </select>
        </div>
        <button type="submit" disabled={!canAfford} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: 'none', background: canAfford ? theme.highlight : '#555', fontWeight: 'bold' }}>{canAfford ? `${totalCost.toLocaleString()}T 결제` : `부족`}</button>
      </form>
    </div>
  );
};

// 📦 상품 등록 페이지 (AI 차단 강화 & 코드 정리)
const RegisterProductPage = ({ isDarkMode, tokens, onRegister, onBan }) => {
  const theme = isDarkMode ? themes.dark : themes.light;
  const navigate = useNavigate();

  // ✨ [추가 1] 파일 입력창을 조종할 리모컨(ref) 생성
  const fileInputRef = useRef(null);
  const fileInputRef3d = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [formData, setFormData] = useState({ name: '', price: '', url: 'https://', category: '가전', image: null, image3d: null, duration: 1, fitMode: 'cover', fitMode3d: 'cover' });
  const durationCost = durationOptions.find((d) => d.days === parseInt(formData.duration))?.cost || 0;
  const totalCost = 500 + durationCost;
  const canAfford = tokens >= totalCost;

  const handleRemoveImage = (type) => {
    setFormData({ ...formData, [type]: null });
    if (type === 'image' && fileInputRef.current) fileInputRef.current.value = '';
    if (type === 'image3d' && fileInputRef3d.current) fileInputRef3d.current.value = '';
  };

  // 예: RegisterAdPage의 handleSubmit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canAfford) return;
    
    setIsScanning(true);

    const fullText = `${formData.name} ${formData.url}`;
    
    // ✨ AI 검사 (텍스트 + 이미지)
    const checkResult = await analyzeContent(fullText, formData.image);

    setIsScanning(false);

    if (!checkResult.isSafe) {
       alert(`🚨 [AI 차단] 유해한 콘텐츠가 감지되었습니다.\n사유: ${checkResult.reason}`);
       return; 
    }

    onRegister({ ...formData, price: parseInt(formData.price), fee: totalCost });
    alert('✅ AI 안전 검사 통과! 상품 등록 완료!');
    navigate('/shop');
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '20px', textAlign: 'center' }}>상품 판매</h1>
      {isScanning && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <ShieldCheck size={60} color="#2ECC71" style={{ marginBottom: '20px' }} />
          <h2>🤖 AI 클린봇 작동 중...</h2>
          <p>상품 정보를 분석하고 있습니다.</p>
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ background: theme.cardBg, padding: '20px', borderRadius: '20px', border: `1px solid ${theme.cardBorder}` }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>상품명</label>
          <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: theme.inputBg, color: theme.text }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>가격</label>
          <input type="number" required value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: theme.inputBg, color: theme.text }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>링크</label>
          <input type="url" required value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: theme.inputBg, color: theme.text }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>카테고리</label>
          <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: theme.inputBg, color: theme.text }}>
            {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
          
          {/* 1. 썸네일 이미지 + 삭제 버튼 */}
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>썸네일</label>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={(e) => handleImageChange(e, 'image')} style={{ color: theme.secondaryText, width: '100%', fontSize: '12px' }} />
            <select value={formData.fitMode} onChange={(e) => setFormData({ ...formData, fitMode: e.target.value })} style={{ marginTop: '5px', padding: '5px', borderRadius: '5px', background: theme.inputBg, color: theme.text }}>
              <option value="cover">꽉 채우기</option> <option value="contain">다 보이기</option>
            </select>
            
            {/* 이미지가 있을 때만 보임 */}
            {formData.image && (
              <div style={{ position: 'relative', marginTop: '5px', width: '100%', height: '80px' }}>
                <img src={formData.image} alt="preview" style={{ width: '100%', height: '100%', objectFit: formData.fitMode, borderRadius: '5px', border: '1px solid #ddd' }} />
                <button 
                  type="button" 
                  onClick={() => handleRemoveImage('image')}
                  style={{ 
                    position: 'absolute', 
                    top: '5px',       
                    right: '5px',     
                    zIndex: 100,       // ✨ 맨 위로 오게 설정
                    background: 'rgba(255, 0, 0, 0.8)', // 빨간색 배경
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '50%', 
                    width: '24px', 
                    height: '24px', 
                    cursor: 'pointer', 
                    fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                  X
                </button>
              </div>
            )}
          </div>

          {/* 2. 3D 매대용 이미지 + 삭제 버튼 */}
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>3D 매대용</label>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={(e) => handleImageChange(e, 'image3d')} style={{ color: theme.secondaryText, width: '100%', fontSize: '12px' }} />
            <select value={formData.fitMode3d} onChange={(e) => setFormData({ ...formData, fitMode3d: e.target.value })} style={{ marginTop: '5px', padding: '5px', borderRadius: '5px', background: theme.inputBg, color: theme.text }}>
              <option value="cover">꽉 채우기</option> <option value="contain">다 보이기</option>
            </select>
            
            {formData.image3d && (
              <div style={{ position: 'relative', marginTop: '5px', width: '100%', height: '80px' }}>
                <img src={formData.image3d} alt="preview" style={{ width: '100%', height: '100%', objectFit: formData.fitMode3d, borderRadius: '5px', border: '1px solid #ddd' }} />
                <button 
                  type="button"
                  onClick={() => handleRemoveImage('image3d')}
                  style={{ 
                    position: 'absolute', 
                    top: '5px', 
                    right: '5px', 
                    zIndex: 100,
                    background: 'rgba(255, 0, 0, 0.8)',
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '50%', 
                    width: '24px', 
                    height: '24px', 
                    cursor: 'pointer', 
                    fontWeight: 'bold',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                  X
                </button>
              </div>
            )}
          </div>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>기간</label>
          <select value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: theme.inputBg, color: theme.text }}>
            {durationOptions.map((opt) => (<option key={opt.days} value={opt.days}>{opt.label}</option>))}
          </select>
        </div>
        <button type="submit" disabled={!canAfford} style={{ width: '100%', padding: '15px', borderRadius: '15px', border: 'none', background: canAfford ? theme.highlight : '#555', fontWeight: 'bold' }}>{canAfford ? `${totalCost.toLocaleString()}T 결제` : `부족`}</button>
      </form>
    </div>
  );
};

// 💰 토큰 페이지 (모바일 결제 후 자동 적립 기능 포함)
const TokenPage = ({ isDarkMode, onCharge, user }) => {
  const theme = isDarkMode ? themes.dark : themes.light;
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  const packages = [
    { id: 1, amount: 1000, bonus: 0, price: 1000, color: '#cd7f32' },
    { id: 2, amount: 5000, bonus: 500, price: 5000, color: '#C0C0C0' },
    { id: 3, amount: 10000, bonus: 3000, price: 10000, color: '#FFD700' },
    { id: 4, amount: 50000, bonus: 15000, price: 50000, color: '#00ccff' },
  ];

  // 🔄 모바일 결제 후 돌아왔을 때 처리
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const paymentId = urlParams.get('paymentId');
    const amountStr = urlParams.get('amount');

    // 결제 ID와 금액이 URL에 있다면? -> 충전 실행!
    if (paymentId && amountStr) {
      const amountToAdd = parseInt(amountStr, 10);
      
      // 여기서 chargeTokens 함수를 실행!
      onCharge(amountToAdd); 
      
      alert(`결제 완료! 🎉\n${amountToAdd.toLocaleString()}T가 충전됩니다.`);
      
      // URL 청소 (새로고침 시 중복 방지)
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []); // 처음 한 번만 실행

  const handlePayment = async (pkg) => {
    if (!window.PortOne) return alert("결제 시스템 로딩 중...");

    try {
      const totalTokens = pkg.amount + pkg.bonus;
      const response = await window.PortOne.requestPayment({
        storeId: "store-15bf6eb3-5f70-4e99-a52e-065074dc1bbb", 
        channelKey: "channel-key-44cc627e-0d0a-4450-a472-51e9a714b003", 
        paymentId: `payment-${crypto.randomUUID()}`,
        orderName: `${pkg.amount}T 토큰 충전`,
        totalAmount: pkg.price,
        currency: "CURRENCY_KRW",
        payMethod: "CARD",
        // 🚨 돌아올 때 '충전할 양(amount)'을 꼬리표로 붙여서 보냄!
        redirectUrl: `${window.location.origin}/token?amount=${totalTokens}`, 
        customer: { fullName: user?.name || "익명", email: user?.email || "no-email@test.com" },
      });

      if (!response && /Mobi|Android/i.test(navigator.userAgent)) return; 
      if (response && response.code != null) return alert(`결제 실패: ${response.message}`);

      // PC 결제 성공 시
      await onCharge(totalTokens);
      alert(`🎉 충전 완료! ${totalTokens.toLocaleString()}T`);

    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
        토큰 충전소 <Coins size={32} color="#FFD700" />
      </h1>
      <p style={{ marginBottom: '30px', color: theme.secondaryText }}>원하는 만큼 토큰을 충전해보세요.</p>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        {packages.map((pkg) => (
          <div key={pkg.id} onClick={() => handlePayment(pkg)} style={{ padding: '20px', background: theme.cardBg, border: `2px solid ${pkg.color}`, borderRadius: '15px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ textAlign: 'left' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>{(pkg.amount + pkg.bonus).toLocaleString()} T</h3>
              <span style={{ fontSize: '12px', color: '#FF5252' }}>{pkg.bonus > 0 ? `+${pkg.bonus} Bonus` : ''}</span>
            </div>
            <div style={{ padding: '5px 15px', background: pkg.color, color: 'black', fontWeight: 'bold', borderRadius: '10px' }}>{pkg.price.toLocaleString()}원</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 👤 마이 페이지 (수정됨: 닉네임 변경 시 중복 확인 추가)
const MyPage = ({ isDarkMode, user, adList, productList, onDeleteAd, onDeleteProduct, onUpdateProductSale, onEditItem, onLogout }) => {
  // 👇 [MyPage] 건의함 전송 로직
  const [feedback, setFeedback] = useState("");
  const [isSending, setIsSending] = useState(false);

  // 👇 [수정됨] 건의함 로직 (내용 매칭 수정 완료)
  const handleSendFeedback = async () => {
    if (!feedback.trim()) return alert("내용을 입력해주세요!");
    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("로그인이 필요합니다.");

      // 1. Supabase 저장
      const { error } = await supabase.from('feedback').insert([{ user_id: user.id, message: feedback }]);
      if (error) throw error;

      // 2. EmailJS 전송
      const SERVICE_ID = 'service_5c5lawj'; 
      const TEMPLATE_ID = 'template_ij6cluh'; // 🚨 아까 만든 [새 템플릿 ID] 확인!
      const PUBLIC_KEY = '_65YQMzv3f_w96uia'; 

      // ✨ 여기가 핵심! 'message' 칸에 유저가 쓴 'feedback'을 넣어야 해
      const templateParams = { 
        reporter: user.email, 
        message: feedback 
      };

      await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);

      alert("소중한 의견 감사합니다! 💌 (메일로 전송되었습니다)");
      setFeedback("");
    } catch (error) {
      console.error(error);
      alert("전송 실패.. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSending(false);
    }
  };
  const theme = isDarkMode ? themes.dark : themes.light;
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate();
  
  const myAds = adList.filter((ad) => ad.isMine);
  const myProducts = productList.filter((p) => p.isMine);
  const wishList = productList.filter((p) => p.isLiked);
  
  const [userInfo, setUserInfo] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '010-0000-0000',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(userInfo);
  const [editingSaleId, setEditingSaleId] = useState(null);
  const [saleForm, setSaleForm] = useState({ price: '', days: 7 });
  const [editModalData, setEditModalData] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const startSaleEdit = (product) => { setEditingSaleId(product.id); setSaleForm({ price: product.discountPrice || product.price * 0.9, days: 7 }); };
  const submitSale = (id) => { onUpdateProductSale(id, parseInt(saleForm.price), parseInt(saleForm.days)); setEditingSaleId(null); };
  const cancelSale = (id) => { onUpdateProductSale(id, 0, 0); setEditingSaleId(null); };

  // ✨ [수정됨] 프로필 저장 함수 (중복 체크 + AI 검사)
  const handleSaveProfile = async () => {
    if (!editForm.name.trim()) return alert("닉네임을 입력해주세요.");

    // 1. ✨ 이름이 바뀌었다면 중복 검사 실행
    if (editForm.name !== userInfo.name) {
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('name')
        .eq('name', editForm.name)
        .maybeSingle();

      if (existingUser) {
        return alert("🚨 이미 사용 중인 닉네임입니다. 다른 이름을 사용해주세요.");
      }
    }

    // 2. AI 유해성 검사
    const checkResult = await analyzeContent(editForm.name, null, 'profile');
    
    if (!checkResult.isSafe) {
      alert(`🚨 닉네임 사용 불가: ${checkResult.reason}`);
      setEditForm({ ...editForm, name: userInfo.name }); 
      return;
    }

    // 3. DB 업데이트 (프로필 테이블)
    const { error } = await supabase
      .from('profiles')
      .update({ name: editForm.name })
      .eq('id', user.id);

    if (error) {
      console.error("업데이트 실패:", error);
      return alert("저장 중 오류가 발생했습니다.");
    }

    setUserInfo(editForm);
    setIsEditing(false);
    alert('✅ 닉네임이 변경되었습니다!');
  };

  const openEditModal = (item, type) => { setEditModalData({ ...item, itemType: type }); };
  const handleEditSave = (updatedData) => { onEditItem(updatedData.id, updatedData, editModalData.itemType); setEditModalData(null); };

  const handleDeleteAccount = async () => {
    if (isDeleting) return; 
    if (!window.confirm("정말로 탈퇴하시겠습니까?\n(확인을 누르면 즉시 계정이 삭제됩니다)")) return;
    setIsDeleting(true);
    try {
      const deletePromise = supabase.rpc('delete_own_account');
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 1000));
      await Promise.race([deletePromise, timeoutPromise]);
    } catch (error) {
      console.warn("탈퇴 에러 무시:", error);
    } finally {
      alert("탈퇴가 완료되었습니다. 이용해 주셔서 감사합니다.");
      onLogout(); 
      localStorage.clear(); 
      window.location.href = '/'; 
    }
  };
    
  return (
    <div style={{ maxWidth: '100%', margin: '0 auto', padding: isMobile ? '10px' : '40px', display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '40px' }}>
      <EditModal isOpen={!!editModalData} onClose={() => setEditModalData(null)} data={editModalData} onSave={handleEditSave} theme={theme} />
      
      {/* 왼쪽 메뉴 */}
      <div style={{ width: isMobile ? '100%' : '250px', background: isDarkMode ? '#222' : '#f4f4f4', padding: '20px', borderRadius: '15px', height: 'fit-content', boxSizing: 'border-box' }}>
        <h2 style={{ fontSize: '20px', marginBottom: '15px', fontWeight: 'bold' }}>Menu</h2>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: '10px', overflowX: 'auto' }}>
          <button onClick={() => navigate('/register-ad')} style={{ padding: '15px', background: theme.cardBg, border: 'none', borderRadius: '10px', cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontWeight: 'bold', color: theme.text, whiteSpace: 'nowrap' }}><PlusCircle size={18} color={theme.highlight} /> 광고</button>
          <button onClick={() => navigate('/register-product')} style={{ padding: '15px', background: theme.cardBg, border: 'none', borderRadius: '10px', cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontWeight: 'bold', color: theme.text, whiteSpace: 'nowrap' }}><Package size={18} color="#FF5252" /> 상품</button>
          <button onClick={() => navigate('/token')} style={{ padding: '15px', background: theme.cardBg, border: 'none', borderRadius: '10px', cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontWeight: 'bold', color: theme.text, whiteSpace: 'nowrap' }}><Coins size={18} color="#00ccff" /> 충전</button>
        </div>
        <div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '20px' }}>
            <button onClick={handleDeleteAccount} disabled={isDeleting} style={{ width: '100%', padding: '10px', background: isDeleting ? '#ccc' : 'transparent', border: isDeleting ? 'none' : '1px solid #ff4444', color: isDeleting ? '#666' : '#ff4444', borderRadius: '10px', cursor: isDeleting ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                {isDeleting ? '탈퇴 처리 중...' : '회원 탈퇴'}
            </button>
        </div>
      </div>

      {/* 오른쪽 컨텐츠 */}
      <div style={{ flex: 1 }}>
        <h1 style={{ fontSize: '28px', marginBottom: '20px' }}>마이 페이지 👤</h1>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '30px' }}>
          {/* 1. 찜한 목록 */}
          <div style={{ background: theme.cardBg, padding: '20px', borderRadius: '15px', border: `1px solid ${theme.cardBorder}` }}>
            <h2 style={{ fontSize: '18px', borderBottom: `1px solid ${theme.navBorder}`, paddingBottom: '10px', marginBottom: '15px' }}>💖 찜한 목록 ({wishList.length})</h2>
            {wishList.length === 0 ? (<p style={{ color: theme.secondaryText }}>없음</p>) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {wishList.map((p) => (
                  <div key={p.id} onClick={() => window.open(p.url, '_blank')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: isDarkMode ? '#222' : '#fff', borderRadius: '10px', border: `1px solid ${theme.cardBorder}`, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {p.image && <img src={p.image} alt="thum" style={{ width: '40px', height: '40px', borderRadius: '5px', objectFit: 'cover' }} />}
                      <div><div style={{ fontWeight: 'bold' }}>{p.name}</div><div style={{ color: theme.secondaryText, fontSize: '12px' }}>{p.price.toLocaleString()}원</div></div>
                    </div>
                    <ExternalLink size={14} color={theme.secondaryText} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. 정보 수정 */}
          <div style={{ background: theme.cardBg, padding: '20px', borderRadius: '15px', border: `1px solid ${theme.cardBorder}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: `1px solid ${theme.navBorder}`, paddingBottom: '10px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>⚙️ 정보 수정</h2>
              {!isEditing ? (<button onClick={() => setIsEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.secondaryText }}><Edit2 size={18} /></button>) : (<button onClick={handleSaveProfile} style={{ background: theme.highlight, border: 'none', borderRadius: '5px', padding: '5px 10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>저장</button>)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div><label style={{ fontSize: '12px', color: theme.secondaryText }}>닉네임</label>{isEditing ? (<input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ width: '100%', padding: '5px' }} />) : (<div style={{ fontWeight: 'bold' }}>{userInfo.name}</div>)}</div>
              <div><label style={{ fontSize: '12px', color: theme.secondaryText }}>이메일</label><div style={{ fontWeight: 'bold' }}>{userInfo.email}</div></div>
            </div>
          </div>

          {/* 3. 고객 센터 (통합됨: 연락처 + 건의함) */}
          <div style={{ background: theme.cardBg, padding: '20px', borderRadius: '15px', border: `1px solid ${theme.cardBorder}` }}>
            <h2 style={{ fontSize: '18px', borderBottom: `1px solid ${theme.navBorder}`, paddingBottom: '10px', marginBottom: '15px' }}>🎧 고객센터</h2>
            
            {/* (1) 연락처 정보 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '10px', background: isDarkMode ? '#333' : '#eee', borderRadius: '50%' }}><Phone size={20} color={theme.highlight} /></div>
                <div><div style={{ fontWeight: 'bold' }}>1588-0000</div><div style={{ fontSize: '12px', color: theme.secondaryText }}>평일 09:00 - 18:00</div></div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '10px', background: isDarkMode ? '#333' : '#eee', borderRadius: '50%' }}><Mail size={20} color="#FF5252" /></div>
                <div><div style={{ fontWeight: 'bold' }}>help@adcube.com</div><div style={{ fontSize: '12px', color: theme.secondaryText }}>24시간 접수 가능</div></div>
              </div>
            </div>

            {/* 중간 구분선 */}
            <div style={{ borderTop: `1px solid ${theme.navBorder}`, margin: '20px 0' }}></div>

            {/* (2) 건의함 (같은 박스 안에 쏙!) */}
            <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>💌 건의함</h2>
            <p style={{ fontSize: '12px', color: theme.secondaryText, marginBottom: '10px' }}>불편한 점이나 바라는 점을 적어주세요.</p>
            
            <textarea
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', minHeight: '80px', resize: 'none', marginBottom: '10px', background: theme.inputBg, color: theme.text }}
              placeholder="소중한 의견을 남겨주세요..."
              value={feedback} onChange={(e) => setFeedback(e.target.value)}
            />
            
            <button
              onClick={handleSendFeedback} disabled={isSending}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', backgroundColor: isSending ? '#ccc' : theme.highlight, color: isSending ? 'white' : 'black', fontWeight: 'bold', border: 'none', cursor: isSending ? 'not-allowed' : 'pointer' }}
            >
              {isSending ? "전송 중..." : "의견 보내기 🚀"}
            </button>
          </div>
          
          {/* 4. 내 상품 관리 */}
          <div style={{ background: theme.cardBg, padding: '20px', borderRadius: '15px', border: `1px solid ${theme.cardBorder}` }}>
            <h2 style={{ fontSize: '18px', borderBottom: `1px solid ${theme.navBorder}`, paddingBottom: '10px', marginBottom: '15px' }}>📦 내 상품 관리</h2>
            {myProducts.length === 0 ? (<p style={{ color: theme.secondaryText }}>없음</p>) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {myProducts.map((p) => (
                  <div key={p.id} onClick={() => window.open(p.url, '_blank')} style={{ padding: '15px', background: isDarkMode ? '#222' : '#fff', borderRadius: '10px', border: `1px solid ${theme.cardBorder}`, cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        {p.image && <img src={p.image} alt="thum" style={{ width: '50px', height: '50px', borderRadius: '5px', objectFit: 'cover' }} />}
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{p.name}</div>
                          <div style={{ color: theme.secondaryText, fontSize: '12px' }}>
                            {p.discountPrice ? <><span style={{ textDecoration: 'line-through' }}>{p.price.toLocaleString()}</span> <span style={{ color: theme.sale }}>{p.discountPrice.toLocaleString()}</span></> : `${p.price.toLocaleString()}원`}
                          </div>
                          <div style={{ fontSize: '11px', color: isExpired(p.expiryDate) ? 'red' : theme.highlight }}>{getDaysLeft(p.expiryDate)} 남음</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        <button onClick={(e) => { e.stopPropagation(); startSaleEdit(p); }} style={{ padding: '5px 10px', borderRadius: '5px', border: 'none', background: theme.highlight, cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}><Percent size={14} /> 세일</button>
                        <button onClick={(e) => { e.stopPropagation(); openEditModal(p, 'product'); }} style={{ padding: '5px 10px', borderRadius: '5px', border: 'none', background: '#333', color: 'white', cursor: 'pointer' }}><Edit2 size={14} /></button>
                        <button onClick={(e) => { e.stopPropagation(); if (window.confirm('정말 삭제하시겠습니까?')) onDeleteProduct(p.id); }} style={{ background: '#FF5252', padding: '5px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer', color: 'white' }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {editingSaleId === p.id && (
                      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '10px', padding: '10px', background: isDarkMode ? '#333' : '#eee', borderRadius: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px' }}>⚡ 세일 설정</div>
                        <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                          <input type="number" placeholder="할인가" value={saleForm.price} onChange={(e) => setSaleForm({ ...saleForm, price: e.target.value })} style={{ flex: 1, padding: '5px' }} />
                          <input type="number" placeholder="기간(일)" value={saleForm.days} onChange={(e) => setSaleForm({ ...saleForm, days: e.target.value })} style={{ width: '60px', padding: '5px' }} />
                        </div>
                        <div style={{ display: 'flex', gap: '5px' }}>
                          <button onClick={() => submitSale(p.id)} style={{ flex: 1, background: theme.text, color: theme.bg, border: 'none', padding: '5px', cursor: 'pointer' }}>적용</button>
                          <button onClick={() => cancelSale(p.id)} style={{ flex: 1, background: '#FF5252', color: 'white', border: 'none', padding: '5px', cursor: 'pointer' }}>취소</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5. 내 광고 관리 */}
          <div style={{ background: theme.cardBg, padding: '20px', borderRadius: '15px', border: `1px solid ${theme.cardBorder}` }}>
            <h2 style={{ fontSize: '18px', borderBottom: `1px solid ${theme.navBorder}`, paddingBottom: '10px', marginBottom: '15px' }}>📺 내 광고 관리</h2>
            {myAds.length === 0 ? (<p style={{ color: theme.secondaryText }}>없음</p>) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {myAds.map((ad) => (
                  <div key={ad.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: isDarkMode ? '#222' : '#fff', borderRadius: '10px', border: `1px solid ${theme.cardBorder}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {ad.image && <img src={ad.image} alt="thum" style={{ width: '40px', height: '40px', borderRadius: '5px', objectFit: 'cover' }} />}
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{ad.title}</div>
                        <div style={{ fontSize: '11px', color: isExpired(ad.expiryDate) ? 'red' : theme.highlight }}>{getDaysLeft(ad.expiryDate)} 남음</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={() => openEditModal(ad, 'ad')} style={{ padding: '5px', borderRadius: '5px', border: 'none', background: '#333', color: 'white', cursor: 'pointer' }}><Edit2 size={16} /></button>
                      <button onClick={() => { if (window.confirm('삭제하시겠습니까??')) onDeleteAd(ad.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.delete }}><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const CSPage = () => (<div><h1>고객센터</h1></div>);

// 🚀 메인 App (스타일 주입 추가됨)
export default function App() {
  const [isDarkMode, setIsDarkMode] = usePersistedState('isDarkMode', false);
  const toggleTheme = () => setIsDarkMode(!isDarkMode);
  const [tokens, setTokens] = usePersistedState('tokens', 0);
  const defaultExpiry = addDays(new Date(), 30).toISOString();
  const [isLoggedIn, setIsLoggedIn] = usePersistedState('isLoggedIn', false);
  const [currentUser, setCurrentUser] = usePersistedState('currentUser', null);
  const [bannedUsers, setBannedUsers] = usePersistedState('bannedUsers', []);

  // ✨ 신고 관련 state 추가
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState({ id: null, type: null });

  // 🔑 로그인 처리
  const handleLogin = async (email) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) {
        setCurrentUser({ email, name: '알 수 없음', tokens: 0 });
        setIsLoggedIn(true);
      } else {
        setCurrentUser(data); 
        setIsLoggedIn(true);
        setTokens(data.tokens || 0);
      }
    } catch (err) {
      console.error(err);
    }
  };
  
  // 🚪 로그아웃
  const handleLogout = () => { 
    setIsLoggedIn(false); 
    setCurrentUser(null); 
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('tokens'); 
  };
  
  const handleBanUser = () => { if (currentUser) { setBannedUsers((prev) => [...prev, currentUser.email]); setIsLoggedIn(false); setCurrentUser(null); } };
  const [adList, setAdList] = usePersistedState('adList', []);
  const [productList, setProductList] = usePersistedState('productList', []);
  const calculateTags = (products) => {
    return products.map((p) => {
      let tag = null; const today = new Date(); const pDate = new Date(p.date); const diffDays = Math.ceil(Math.abs(today - pDate) / (1000 * 60 * 60 * 24));
      if (p.discountPrice && p.discountPrice > 0) tag = 'SALE'; else if (p.views >= 1000 || p.likes >= 50 || p.sales >= 10) tag = 'HOT'; else if (diffDays <= 7) tag = 'NEW';
      return { ...p, calculatedTag: tag };
    });
  };
  const processedProductList = calculateTags(productList);
  // 1. [수정됨] 토큰 충전 함수 (덮어쓰기 방지: DB 확인 후 더하기)
  const chargeTokens = async (amount) => {
    try {
      // (1) 현재 로그인한 진짜 유저 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("로그인 정보가 없습니다. 다시 로그인해주세요.");

      // (2) 🚨 중요: DB에서 '진짜 현재 잔액'을 먼저 가져옴!
      const { data: profile, error: fetchError } = await supabase
        .from('profiles')
        .select('tokens')
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;

      // (3) 가져온 잔액 + 충전할 금액
      const currentDBTokens = profile.tokens || 0; 
      const newTotal = currentDBTokens + amount;

      // (4) 합친 금액으로 업데이트
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ tokens: newTotal })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // (5) 성공하면 화면도 업데이트
      setTokens(newTotal);
      if (currentUser) {
        setCurrentUser(prev => ({ ...prev, tokens: newTotal }));
      }
      
      // (6) 모바일 결제 후라면 알림 띄우기
      // (TokenPage에서 alert을 띄우겠지만 여기서도 콘솔로 확인)
      console.log(`충전 성공! 기존: ${currentDBTokens} + 충전: ${amount} = 합계: ${newTotal}`);

    } catch (err) {
      console.error("토큰 충전 중 오류:", err);
      alert("토큰 저장에 실패했습니다. 관리자에게 문의하세요.");
    }
  };
  // 3. 상품 등록 함수 (DB 차감 추가됨)
  const registerProduct = async (newProduct) => {
    const newTotal = tokens - newProduct.fee;
    setTokens(newTotal); // 화면 차감

    if (currentUser) {
      await supabase.from('profiles').update({ tokens: newTotal }).eq('id', currentUser.id);
    }

    const expiryDate = addDays(new Date(), newProduct.duration).toISOString();
    setProductList((prev) => [{ id: Date.now(), ...newProduct, sales: 0, likes: 0, views: 0, date: new Date().toISOString().split('T')[0], expiryDate, isMine: true, isLiked: false }, ...prev]);
  };
  const deleteAd = (id) => setAdList((prev) => prev.filter((ad) => ad.id !== id));
  const deleteProduct = (id) => setProductList((prev) => prev.filter((p) => p.id !== id));
  const updateProductSale = (id, salePrice, saleDays) => {
    setProductList((prev) => prev.map((p) => {
      if (p.id === id) {
        if (salePrice <= 0) return { ...p, discountPrice: undefined, saleEndDate: undefined };
        const saleEndDate = addDays(new Date(), saleDays).toISOString();
        return { ...p, discountPrice: salePrice, saleEndDate };
      }
      return p;
    }));
  };
  const toggleLike = (id) => { setProductList((prev) => prev.map((p) => { if (p.id === id) return { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }; return p; })); };
  const incrementView = (id, isAd = false) => {
    if (isAd) setAdList((prev) => prev.map((ad) => (ad.id === id ? { ...ad, views: ad.views + 1 } : ad)));
    else setProductList((prev) => prev.map((p) => (p.id === id ? { ...p, views: p.views + 1 } : p)));
  };
  const handleEditItem = (id, updatedData, type) => {
    if (type === 'ad') { setAdList((prev) => prev.map((ad) => (ad.id === id ? { ...ad, ...updatedData } : ad))); }
    else { setProductList((prev) => prev.map((p) => (p.id === id ? { ...p, ...updatedData } : p))); }
  };
  const ProtectedRoute = ({ children }) => { if (!isLoggedIn) { return <Navigate to="/login" replace />; } return children; };

  // ✨ 신고 모달 열기 함수
  const openReportModal = (id, type) => {
    if (!isLoggedIn) return alert("로그인이 필요한 기능입니다.");
    setReportTarget({ id, type });
    setReportModalOpen(true);
  };

  // ✨ 신고 제출 처리 함수 (여기에 ID를 넣어야 해!)
  const submitReport = async (reason) => {
    try {
      // 1. Supabase DB에 저장
      const { error } = await supabase.from('reports').insert([
        {
          target_id: reportTarget.id,
          target_type: reportTarget.type,
          reason: reason,
          reporter_email: currentUser?.email || 'anonymous'
        }
      ]);

      if (error) throw error;

      // 2. 📧 내 메일로 알림 보내기 (EmailJS)
      // 👇 [중요] 아까 메모한 값들을 여기에 복사+붙여넣기 해!
      const SERVICE_ID = 'service_5c5lawj';   // 예: service_8a2k1d
      const TEMPLATE_ID = 'template_czfiz4e'; // 예: template_b9s3x2
      const PUBLIC_KEY = '_65YQMzv3f_w96uia';      // 예: Public Key (긴 영어+숫자)

      const templateParams = {
        reporter: currentUser?.email || '익명',
        reason: reason,
        target_id: `${reportTarget.type} #${reportTarget.id}`,
        message: `관리자님, 새로운 신고가 들어왔습니다. 확인해주세요!`
      };

      await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);

      alert("🚨 신고가 접수되었습니다.\n관리자에게 메일로 알림이 전송되었습니다.");
      setReportModalOpen(false);

    } catch (error) {
      console.error("신고 오류:", error);
      alert("신고는 접수되었으나 메일 발송에 실패했습니다. (DB 저장 완료)");
    }
  };

  const theme = isDarkMode ? themes.dark : themes.light; // 모달에 테마 전달용

  return (
    <Router>
      {/* ✨ [핵심 수정] 여기에 globalStyles를 넣어야 입력창 튀어나옴 현상이 해결됨! */}
      <style>{globalStyles}</style>

      {/* ✨ 신고 모달 연결 */}
      <ReportModal 
        isOpen={reportModalOpen} 
        onClose={() => setReportModalOpen(false)} 
        onSubmit={submitReport} 
        theme={theme} 
      />

<Layout isDarkMode={isDarkMode} toggleTheme={toggleTheme} tokens={tokens} isLoggedIn={isLoggedIn} user={currentUser} onLogout={handleLogout}>
        <Routes>
          {/* 👇 [수정 1] AdPage에 onReport 전달 추가 */}
          <Route path="/" element={<AdPage isDarkMode={isDarkMode} adList={adList} onAdClick={(id) => incrementView(id, true)} onReport={openReportModal} />} />
          
          {/* 👇 [수정 2] ShopPage에 onReport 전달 추가 */}
          <Route path="/shop" element={<ShopPage isDarkMode={isDarkMode} productList={processedProductList} onToggleLike={toggleLike} onProductClick={(id) => incrementView(id, false)} onReport={openReportModal} />} />
          
          <Route path="/login" element={<LoginPage isDarkMode={isDarkMode} onLogin={handleLogin} />} />
          <Route path="/signup" element={<SignUpPage isDarkMode={isDarkMode} />} />
          <Route path="/register-ad" element={<ProtectedRoute><RegisterAdPage isDarkMode={isDarkMode} tokens={tokens} onRegister={registerAd} onBan={handleBanUser} /></ProtectedRoute>} />
          <Route path="/register-product" element={<ProtectedRoute><RegisterProductPage isDarkMode={isDarkMode} tokens={tokens} onRegister={registerProduct} onBan={handleBanUser} /></ProtectedRoute>} />
          <Route path="/token" element={<ProtectedRoute><TokenPage isDarkMode={isDarkMode} onCharge={chargeTokens} user={currentUser} /></ProtectedRoute>} />
          <Route path="/mypage" element={<ProtectedRoute><MyPage isDarkMode={isDarkMode} user={currentUser} adList={adList} productList={processedProductList} onDeleteAd={deleteAd} onDeleteProduct={deleteProduct} onUpdateProductSale={updateProductSale} onEditItem={handleEditItem} onLogout={handleLogout} /></ProtectedRoute>} />
          <Route path="/cs" element={<CSPage />} />
          <Route path="*" element={<div style={{ textAlign: 'center', marginTop: '50px' }}><h1>404</h1><p>페이지 없음</p></div>} />
        </Routes>
      </Layout>
    </Router>
  );
}