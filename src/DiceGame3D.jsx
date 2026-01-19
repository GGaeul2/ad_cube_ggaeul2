import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics, useBox, usePlane } from '@react-three/cannon';
import { OrbitControls, Stars, Text } from '@react-three/drei';
import * as THREE from 'three';
import { supabase } from './supabaseClient';

// 🟦 게임 설정
const BOARD_SIZE = 32; 
const TILE_SIZE = 2.5; 
const GRID_TILES = 9;

// 📅 날짜 포맷 헬퍼 (YYYY-MM-DD 표준화)
const getTodayDate = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 🎨 파스텔톤 색상
const COLORS = {
  side1: '#FFB7B2', side2: '#A0E7E5', side3: '#B9F6CA', side4: '#E0BBE4',
  corner: '#FFD700', bonus: '#FF69B4', text: '#555555'
};

// 🗺️ 보드판 정보 계산
const getBoardInfo = (index) => {
  const offset = ((GRID_TILES - 1) * TILE_SIZE) / 2;
  let x = 0, z = 0;
  let color = COLORS.side1;
  const isCorner = index % 8 === 0;
  const isBonus = index % 8 === 4;

  if (index < 8) { x = offset - index * TILE_SIZE; z = offset; color = COLORS.side1; }
  else if (index < 16) { x = -offset; z = offset - (index - 8) * TILE_SIZE; color = COLORS.side2; }
  else if (index < 24) { x = -offset + (index - 16) * TILE_SIZE; z = -offset; color = COLORS.side3; }
  else { x = offset; z = -offset + (index - 24) * TILE_SIZE; color = COLORS.side4; }

  if (isCorner) color = COLORS.corner;
  if (isBonus) color = COLORS.bonus;

  return { pos: [x, 0.1, z], color, isCorner, isBonus };
};

// 🎲 숫자 텍스트
const DiceNumber = ({ number, position, rotation }) => (
  <Text position={position} rotation={rotation} fontSize={0.6} color="black" fontWeight="bold" anchorX="center" anchorY="middle">
    {number}
  </Text>
);

// 🎲 리얼 주사위
const RealDice = ({ isThrown, onStop, setRef, throwTrigger, canPlay }) => {
  const [ref, api] = useBox(() => ({ 
    mass: 1, 
    position: [0, 5, 20], 
    args: [1, 1, 1],
    material: { friction: 0.1, restitution: 0.5 },
    allowSleep: false
  }));
  
  const quaternion = useRef([0, 0, 0, 1]);
  const velocity = useRef([0, 0, 0]);
  const isFlying = useRef(false);
  const startTime = useRef(0);

  useEffect(() => {
    const unsubQ = api.quaternion.subscribe((q) => (quaternion.current = q));
    const unsubV = api.velocity.subscribe((v) => (velocity.current = v));
    setRef(api);
    return () => { unsubQ(); unsubV(); };
  }, [api, setRef]);

  // 🔥 던지기 로직
  useEffect(() => {
    if (throwTrigger > 0) {
      isFlying.current = true;
      startTime.current = Date.now();
      
      api.position.set(0, 5, 20); 
      api.velocity.set(0, 0, 0); 
      api.angularVelocity.set(0, 0, 0);

      const forwardPower = -12; 
      const upPower = 6;       
      const sideRandom = (Math.random() - 0.5) * 5;

      api.wakeUp();
      api.applyImpulse([sideRandom, upPower, forwardPower], [0, 0, 0]);
      api.applyTorque([Math.random()*20, Math.random()*20, Math.random()*20]);
    }
  }, [throwTrigger]);

  // 프레임 루프
  useFrame((state) => {
    // 1. 대기 모드 (안 던졌고 + 플레이 가능할 때)
    if (!isThrown && !isFlying.current && canPlay) {
      const t = state.clock.getElapsedTime();
      api.position.set(0, 5 + Math.sin(t) * 0.5, 20); 
      api.velocity.set(0, 0, 0);
      api.angularVelocity.set(0, 1, 0);
      api.rotation.set(0, t, 0);
    }

    // 2. 결과 판정 (속도 기반)
    if (isFlying.current) {
      const speed = Math.sqrt(
        velocity.current[0]**2 + 
        velocity.current[1]**2 + 
        velocity.current[2]**2
      );

      // 1초 이상 지났고 속도가 거의 0이면 멈춤 판정
      if (Date.now() - startTime.current > 1000 && speed < 0.1) {
        isFlying.current = false;
        calculateAndReportResult();
      }
    }
  });

  const calculateAndReportResult = () => {
    const q = new THREE.Quaternion(...quaternion.current);
    const faces = [
      { num: 1, vector: new THREE.Vector3(0, 0, 1) },
      { num: 6, vector: new THREE.Vector3(0, 0, -1) },
      { num: 2, vector: new THREE.Vector3(1, 0, 0) },
      { num: 5, vector: new THREE.Vector3(-1, 0, 0) },
      { num: 3, vector: new THREE.Vector3(0, 1, 0) },
      { num: 4, vector: new THREE.Vector3(0, -1, 0) },
    ];
    let maxDot = -Infinity;
    let result = 1;
    const worldUp = new THREE.Vector3(0, 1, 0);

    faces.forEach(face => {
      const faceVector = face.vector.clone().applyQuaternion(q);
      const dot = faceVector.dot(worldUp);
      if (dot > maxDot) { maxDot = dot; result = face.num; }
    });
    
    onStop(result);
  };

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ffffff" />
      <DiceNumber number="1" position={[0, 0, 0.51]} rotation={[0, 0, 0]} />
      <DiceNumber number="6" position={[0, 0, -0.51]} rotation={[0, Math.PI, 0]} />
      <DiceNumber number="2" position={[0.51, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <DiceNumber number="5" position={[-0.51, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <DiceNumber number="3" position={[0, 0.51, 0]} rotation={[-Math.PI / 2, 0, 0]} />
      <DiceNumber number="4" position={[0, -0.51, 0]} rotation={[Math.PI / 2, 0, 0]} />
    </mesh>
  );
};

// 🏃 플레이어 말
const PlayerPiece = ({ positionIndex }) => {
  const [targetPos, setTargetPos] = useState([0, 0.5, 0]);
  
  // 위치가 바뀔 때마다 좌표 업데이트
  useEffect(() => {
    const { pos } = getBoardInfo(positionIndex);
    setTargetPos([pos[0], 1, pos[2]]);
  }, [positionIndex]);

  useFrame((state) => {
    const obj = state.scene.getObjectByName('player');
    if (obj) {
        obj.position.lerp(new THREE.Vector3(...targetPos), 0.1);
    }
  });

  return (
    <mesh name="player" position={targetPos} castShadow>
      <cylinderGeometry args={[0.3, 0.3, 1, 32]} />
      <meshStandardMaterial color="#2575fc" />
      <mesh position={[0, 0.8, 0]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#2575fc" />
      </mesh>
    </mesh>
  );
};

// 🟦 환경
const Environment = () => {
  usePlane(() => ({ rotation: [-Math.PI / 2, 0, 0], position: [0, 0, 0] })); 
  usePlane(() => ({ position: [0, 0, -35], rotation: [0, 0, 0] })); 
  usePlane(() => ({ position: [0, 0, 35], rotation: [0, -Math.PI, 0] })); 
  usePlane(() => ({ position: [-35, 0, 0], rotation: [0, Math.PI / 2, 0] })); 
  usePlane(() => ({ position: [35, 0, 0], rotation: [0, -Math.PI / 2, 0] })); 
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <shadowMaterial color="#000" opacity={0.3} transparent />
    </mesh>
  );
};

// 🎮 메인 게임 컴포넌트
const DiceGame3D = ({ user, onCharge, isDarkMode }) => {
  const [isThrown, setIsThrown] = useState(false);
  const [throwTrigger, setThrowTrigger] = useState(0); 
  const [canPlay, setCanPlay] = useState(false); 
  const [message, setMessage] = useState("로딩 중...");
  const [position, setPosition] = useState(0); 
  const [loading, setLoading] = useState(true); 
  const diceApi = useRef(null);

  const LAP_REWARD = 1500;
  const BONUS_SPOTS = [4, 12, 20, 28]; 

  // 로그인 유저 정보가 있을 때만 체크 시작
  useEffect(() => { 
    if (user && user.id) {
        checkStatus(); 
    } else {
        // 유저 정보가 없으면 로딩 해제하지 않음 (화면 보호)
        setLoading(true);
    }
  }, [user]);

  const checkStatus = async () => {
    setLoading(true);
    
    // 유저 ID 없으면 중단 (400 에러 방지)
    if (!user || !user.id) return;

    try {
      // 1. 프로필 정보 가져오기 (없으면 maybeSingle이 null 반환)
      const { data, error } = await supabase.from('profiles').select('last_game_at, game_position').eq('id', user.id).maybeSingle();
      
      if (error) {
        // 컬럼 없음 등의 치명적 DB 에러 시
        console.error("DB Error:", error);
        throw error;
      }

      if (data) {
        // 2. 위치 동기화 (DB에 저장된 위치로)
        const savedPos = data.game_position || 0;
        setPosition(savedPos);
        
        const today = getTodayDate(); 
        // 날짜 형식 안전하게 처리 (2026-01-19T... 형식일 경우 앞부분만)
        const lastDateRaw = data.last_game_at;
        const lastDate = lastDateRaw ? (lastDateRaw.includes('T') ? lastDateRaw.split('T')[0] : lastDateRaw) : null;
        
        const isAvailable = lastDate !== today;
        setCanPlay(isAvailable);
        
        if (isAvailable) {
          setMessage("오늘의 운을 시험해보세요! 🎲");
          setIsThrown(false);
        } else {
          setMessage("오늘은 이미 완료! 내일 이어서 도전하세요 🌙");
          setIsThrown(true); // 이미 했으면 던짐 상태로 고정
        }
      } else {
        // 프로필 데이터가 아예 없는 신규 유저 (가입 직후)
        // 프로필은 보통 회원가입 시 생성되지만, 만약 없다면 기본값
        setPosition(0);
        setCanPlay(true);
        setMessage("첫 도전을 환영합니다! 🎲");
      }
    } catch (err) {
      console.error("상태 확인 실패:", err);
      // 에러 시 안전하게 플레이 막음
      setCanPlay(false); 
      setMessage("데이터 오류: 관리자에게 문의하세요.");
    } finally {
      setLoading(false);
    }
  };

  const throwDice = () => {
    if (!canPlay || isThrown) return; 
    setIsThrown(true); 
    setThrowTrigger(prev => prev + 1); 
    setMessage("운명의 주사위가 굴러갑니다... 🍀");
  };

  const finishRoll = async (diceValue) => {
    if (!diceValue) diceValue = 1;

    let newPos = position + diceValue;
    let reward = 0;
    let resultMsg = `[ ${diceValue} ] 나왔습니다!`;

    if (newPos >= BOARD_SIZE) {
      newPos = newPos % BOARD_SIZE;
      reward += LAP_REWARD;
      resultMsg = `🎉 완주 성공! +${LAP_REWARD}T`;
    }

    if (BONUS_SPOTS.includes(newPos)) {
      resultMsg += " & 🍀 보너스(+100T)!";
      reward += 100;
    }

    if (reward > 0) await onCharge(reward);
    
    // ✨ DB 저장 (매우 중요)
    if (user && user.id) {
        const today = getTodayDate();
        await supabase.from('profiles').update({ 
          game_position: newPos, 
          last_game_at: today 
        }).eq('id', user.id);
    }

    setPosition(newPos);
    setCanPlay(false);
    setMessage(resultMsg);
  };

  return (
    <div style={{ width: '100%', height: '600px', background: isDarkMode ? '#1a1a1a' : '#87CEEB', borderRadius: '20px', position: 'relative', overflow: 'hidden', boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5)' }}>
      {/* 로딩 중일 땐 캔버스 대신 메시지 */}
      {!loading ? (
        <Canvas shadows camera={{ position: [0, 35, 35], fov: 45 }}>
          <ambientLight intensity={0.7} />
          <spotLight position={[10, 50, 10]} angle={0.4} penumbra={1} intensity={1.5} castShadow />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade />
          
          <Physics gravity={[0, -20, 0]} defaultContactMaterial={{ restitution: 0.5, friction: 0.2 }}>
            <RealDice 
              isThrown={isThrown}
              throwTrigger={throwTrigger} 
              onStop={finishRoll} 
              setRef={(api) => (diceApi.current = api)} 
              canPlay={canPlay}
            />
            <Environment />
          </Physics>

          {[...Array(BOARD_SIZE)].map((_, i) => {
            const { pos, color, isCorner, isBonus } = getBoardInfo(i);
            return (
              <group key={i} position={pos}>
                <mesh receiveShadow>
                  <boxGeometry args={[2.2, isCorner ? 0.4 : 0.2, 2.2]} />
                  <meshStandardMaterial color={color} />
                </mesh>
                <Text position={[0, isCorner ? 0.3 : 0.2, 0]} rotation={[-Math.PI/2, 0, 0]} fontSize={0.8} color={isCorner || isBonus ? '#333' : 'white'} fontWeight="bold">
                  {isBonus ? '★' : i}
                </Text>
              </group>
            );
          })}
          <PlayerPiece positionIndex={position} />
          <OrbitControls enableZoom={true} maxPolarAngle={Math.PI / 2.1} minDistance={10} maxDistance={70} />
        </Canvas>
      ) : (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', fontSize: '20px', fontWeight: 'bold' }}>
          데이터 불러오는 중... 🎲
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)' }}>
        <button 
          onClick={throwDice} 
          disabled={!canPlay || isThrown || loading} 
          style={{ 
            padding: '15px 60px', fontSize: '22px', borderRadius: '50px', border: '4px solid white', 
            background: (canPlay && !isThrown && !loading) ? 'linear-gradient(to right, #ff9966, #ff5e62)' : '#555', 
            color: (canPlay && !isThrown && !loading) ? 'white' : '#aaa', 
            cursor: (canPlay && !isThrown && !loading) ? 'pointer' : 'not-allowed', 
            fontWeight: 'bold', 
            boxShadow: '0 10px 25px rgba(0,0,0,0.4)', transition: '0.3s' 
          }}
        >
          {loading ? "..." : (isThrown ? (canPlay ? "굴러가는 중..." : "내일 또 만나요") : "던지기! 🎲")}
        </button>
      </div>
      
      <div style={{ position: 'absolute', top: 30, width: '100%', textAlign: 'center', pointerEvents: 'none' }}>
        <h2 style={{ color: 'white', fontSize: '28px', fontWeight: 'bold', textShadow: '0 3px 6px rgba(0,0,0,0.8)', margin: 0 }}>{message}</h2>
      </div>
    </div>
  );
};

export default DiceGame3D;