import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Dices, Gift, Sparkles, Footprints } from 'lucide-react';

const DiceGame = ({ user, onCharge, isDarkMode }) => {
  const [position, setPosition] = useState(0);
  const [canPlay, setCanPlay] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [diceNum, setDiceNum] = useState(1);
  const [message, setMessage] = useState("오늘의 광고비를 벌어보세요! 🎲");

  // 🎨 게임 설정
  const BOARD_SIZE = 24; 
  const LAP_REWARD = 1500; // ✨ 완주 시 1,500 토큰 (광고 1회분)
  
  // ❓ 럭키 박스 위치 (6, 12, 18번 칸)
  const LUCKY_SPOTS = [6, 12, 18]; 

  const theme = isDarkMode 
    ? { bg: '#222', board: '#333', cell: '#444', active: '#FFD700', lucky: '#9b59b6', text: '#fff' }
    : { bg: '#f9f9f9', board: '#fff', cell: '#eee', active: '#FFD700', lucky: '#E0B0FF', text: '#333' };

  useEffect(() => { if (user) checkStatus(); }, [user]);

  const checkStatus = async () => {
    const { data } = await supabase.from('profiles').select('last_game_at, game_position').eq('id', user.id).single();
    if (data) {
      setPosition(data.game_position || 0);
      const today = new Date().toLocaleDateString();
      setCanPlay(data.last_game_at !== today);
      if (data.last_game_at === today) setMessage("오늘은 이미 완료했습니다! 내일 또 만나요 🌙");
    }
  };

  // ✨ 랜덤 효과 뽑기 함수
  const triggerLuckyEffect = async (currentPos) => {
    const effects = [
      { type: 'move', val: 1, text: '🍀 럭키! 1칸 더 전진!' },
      { type: 'move', val: 2, text: '🚀 대박! 2칸 더 점프!' },
      { type: 'token', val: 100, text: '💎 보너스 100T 획득!' },
      { type: 'token', val: 300, text: '💰 잭팟! 300T 획득!' },
    ];
    // 랜덤 선택
    const effect = effects[Math.floor(Math.random() * effects.length)];
    
    let bonusMsg = effect.text;
    let finalPos = currentPos;

    if (effect.type === 'token') {
      await onCharge(effect.val); // 토큰 즉시 지급
    } else if (effect.type === 'move') {
      finalPos = currentPos + effect.val;
      // 추가 이동으로 완주했는지 체크
      if (finalPos >= BOARD_SIZE) {
        finalPos = finalPos % BOARD_SIZE;
        await onCharge(LAP_REWARD);
        bonusMsg += ` & 완주 보상 (+${LAP_REWARD}T)`;
      }
    }
    return { finalPos, bonusMsg };
  };

  const rollDice = async () => {
    if (!canPlay || rolling) return;
    setRolling(true);
    setMessage("운명의 주사위 굴리는 중... 🎲");

    const interval = setInterval(() => setDiceNum(Math.floor(Math.random() * 6) + 1), 100);

    setTimeout(async () => {
      clearInterval(interval);
      const rollResult = Math.floor(Math.random() * 6) + 1;
      setDiceNum(rollResult);
      
      let newPos = position + rollResult;
      let reward = 0;
      let resultMsg = `${rollResult}칸 이동!`;

      // 1. 완주 체크
      if (newPos >= BOARD_SIZE) {
        newPos = newPos % BOARD_SIZE;
        reward += LAP_REWARD;
        resultMsg = `🎉 완주 성공! 광고비 ${LAP_REWARD}T 획득!`;
      }

      // 2. 럭키 박스 체크 (완주 아닐 때만)
      if (LUCKY_SPOTS.includes(newPos)) {
        const { finalPos, bonusMsg } = await triggerLuckyEffect(newPos);
        newPos = finalPos; // 위치 업데이트 (이동 효과일 경우)
        resultMsg = bonusMsg; // 메시지 교체
      }

      // 3. 보상 지급 및 저장
      if (reward > 0) await onCharge(reward);
      
      const today = new Date().toLocaleDateString();
      await supabase.from('profiles').update({ game_position: newPos, last_game_at: today }).eq('id', user.id);

      setPosition(newPos);
      setCanPlay(false);
      setRolling(false);
      setMessage(resultMsg);
    }, 2000);
  };

  const diceStyle = {
    width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '30px', fontWeight: 'bold', background: 'white', borderRadius: '10px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.2)', border: '2px solid #333', color: '#333',
    transform: rolling ? `rotate(${Math.random() * 360}deg)` : 'none', transition: 'transform 0.2s', margin: '0 auto'
  };

  return (
    <div style={{ background: theme.bg, padding: '20px', borderRadius: '15px', border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`, textAlign: 'center', marginBottom: '30px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: theme.text, display: 'flex', alignItems: 'center', gap: '8px' }}>🎲 일일 미션</h2>
        <span style={{ fontSize: '12px', color: canPlay ? '#2ECC71' : '#FF5252', fontWeight: 'bold' }}>{canPlay ? "도전 가능" : "내일 다시"}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '5px', marginBottom: '20px' }}>
        {[...Array(BOARD_SIZE)].map((_, i) => {
          const isLucky = LUCKY_SPOTS.includes(i);
          return (
            <div key={i} style={{
              height: '30px', borderRadius: '5px',
              background: i === position ? theme.active : (isLucky ? theme.lucky : theme.cell),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', color: i === position ? 'black' : (isLucky ? 'white' : theme.text),
              fontWeight: 'bold', border: i === position ? '2px solid black' : 'none', transition: '0.3s'
            }}>
              {i === position ? '🏃' : (isLucky ? '❓' : i + 1)}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
        <div style={diceStyle}>{rolling ? '?' : diceNum}</div>
        <p style={{ color: theme.text, fontSize: '14px', minHeight: '20px', fontWeight: 'bold' }}>{message}</p>
        <button onClick={rollDice} disabled={!canPlay || rolling} style={{
            padding: '10px 30px', borderRadius: '20px', border: 'none',
            background: canPlay ? 'linear-gradient(45deg, #FFD700, #FFaa00)' : '#555',
            color: canPlay ? 'black' : '#aaa', fontWeight: 'bold', cursor: canPlay ? 'pointer' : 'not-allowed',
            boxShadow: canPlay ? '0 4px 15px rgba(255, 215, 0, 0.4)' : 'none', transform: rolling ? 'scale(0.95)' : 'scale(1)', transition: '0.2s'
          }}>
          {rolling ? "굴리는 중..." : (canPlay ? "주사위 굴리기 (FREE)" : "내일 또 오세요")}
        </button>
      </div>
    </div>
  );
};

export default DiceGame;