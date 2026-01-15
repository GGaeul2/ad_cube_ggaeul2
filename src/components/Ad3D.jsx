import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, RoundedBox, Float, Image as DreiImage, Edges } from '@react-three/drei';

import QRCode from 'qrcode'; 
import * as THREE from 'three';

// ✨ [이미지 컴포넌트] 로딩 중 깜빡임 방지를 위한 백드롭 추가
const AdImage = ({ url, scale, position, fitMode = 'cover' }) => {
  // fitMode에 따라 스케일 조정 (contain이면 약간 축소해서 여백 확보)
  const finalScale = fitMode === 'contain' ? [scale[0] * 0.9, scale[1] * 0.9] : scale;

  return (
    <group position={position}>
      {/* 이미지 뒤에 검은 판을 둬서 로딩 중이나 투명 이미지일 때 뒤가 비치지 않게 함 */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[scale[0], scale[1]]} />
        <meshBasicMaterial color="#111" />
      </mesh>
      <DreiImage url={url} scale={finalScale} transparent />
    </group>
  );
};

// 📦 [큐브 내용물] 텍스트와 이미지를 담당
function CubeContent({ items, mode, isDarkMode }) {
  // 데이터 안전하게 가져오기
  const getList = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data; 
    return data.items || []; 
  };

  const getLength = (data) => {
    const list = getList(data);
    return list.length > 0 ? list.length : 1;
  };

  const [indexes, setIndexes] = useState({ top: 0, s1: 0, s2: 0, s3: 0, s4: 0 });
  const [qrTexture, setQrTexture] = useState(null); // 🆕 QR 텍스처 상태 추가

  // 1️⃣ 기존 타이머 로직
  useEffect(() => {
    const timer = setInterval(() => {
      setIndexes(prev => ({
        top: (prev.top + 1) % getLength(items.top),
        s1: (prev.s1 + 1) % getLength(items.side1),
        s2: (prev.s2 + 1) % getLength(items.side2),
        s3: (prev.s3 + 1) % getLength(items.side3),
        s4: (prev.s4 + 1) % getLength(items.side4),
      }));
    }, 3000); 
    return () => clearInterval(timer);
  }, [items]);

  // 2️⃣ 🆕 진짜 QR코드 생성 로직 (여기가 핵심!)
  useEffect(() => {
    const generateQR = async () => {
      try {
        // 현재 웹사이트 주소 가져오기
        const currentUrl = window.location.href;
        
        // QR 이미지를 데이터 주소(base64)로 변환
        const dataUrl = await QRCode.toDataURL(currentUrl, {
          width: 512,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' }
        });

        // Three.js 텍스처로 로드
        new THREE.TextureLoader().load(dataUrl, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace; // 색상 보정
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          setQrTexture(texture); // 상태 업데이트
        });
      } catch (err) {
        console.error("QR 생성 실패:", err);
      }
    };
    generateQR();
  }, []); // 처음에 한 번만 실행

  const topTextColor = "#FFD700"; 
  const premiumTextColor = "white"; 
  const commonTextColor = "#ffffff";

  // --- 렌더링 헬퍼들 (기존과 동일) ---
  const renderBigFace = (sideData, idx, defaultLabel) => {
    const list = getList(sideData);
    const item = list[idx] || { title: "Coming Soon", image: null };
    const title = !Array.isArray(sideData) ? sideData?.title : null;
    const label = mode === 'SHOP' ? (title || defaultLabel) : defaultLabel;
    
    const imgUrl = item.image3d || item.image;
    const fit = item.fitMode3d || 'cover';

    return (
      <group>
        {imgUrl ? (
          <AdImage url={imgUrl} scale={[3, 3]} position={[0, 0, 0.05]} fitMode={fit} />
        ) : (
          <Text position={[0, 0, 0.1]} fontSize={0.35} color={premiumTextColor} maxWidth={3} textAlign="center">{item.title}</Text>
        )}
        <Text position={[0, -1.2, 0.1]} fontSize={0.2} color={premiumTextColor} fontWeight="bold">{label}</Text>
      </group>
    );
  };

  const renderNormalFace = (sideData, startIdx) => {
    const list = getList(sideData);
    const len = list.length || 1;
    
    const renderStrip = (item, yPos) => {
      const title = item.title || "Coming Soon"; 
      const imgUrl = item.image3d || item.image;
      const fit = item.fitMode3d || 'cover';

      return (
        <group position={[0, yPos, 0]}>
          {imgUrl ? (
            <AdImage url={imgUrl} scale={[3, 0.9]} position={[0, 0, 0.05]} fitMode={fit} />
          ) : (
            <Text position={[0, 0, 0.1]} fontSize={0.25} color={commonTextColor}>{title}</Text>
          )}
        </group>
      );
    };

    return (
      <group>
        {renderStrip(list[startIdx % len] || {}, 1.2)}
        <Text position={[0, 0.6, 0.05]} fontSize={0.2} color="gray">----------</Text>
        {renderStrip(list[(startIdx + 1) % len] || {}, 0)}
        <Text position={[0, -0.6, 0.05]} fontSize={0.2} color="gray">----------</Text>
        {renderStrip(list[(startIdx + 2) % len] || {}, -1.2)}
      </group>
    );
  };

  const renderTopFace = () => {
    const list = items.top || [];
    const item = list[indexes.top] || { title: "HOT", image: null };
    const imgUrl = item.image3d || item.image;
    const fit = item.fitMode3d || 'cover';

    return (
      <group>
         <Text position={[0, 1.2, 0.1]} fontSize={0.3} color="#FF5252" fontWeight="bold">🔥 HOT BEST 🔥</Text>
         {imgUrl ? (
           <AdImage url={imgUrl} scale={[2.5, 2.5]} position={[0, -0.2, 0.05]} fitMode={fit} />
         ) : (
           <Text position={[0, -0.2, 0.1]} fontSize={0.4} color={topTextColor} fontWeight="bold">{item.title}</Text>
         )}
      </group>
    );
  };

  const dist = 1.8;

  return (
    <group>
        <group position={[0, 0, dist]}>{mode === 'SHOP' ? renderBigFace(items.side1, indexes.s1, 'Category') : renderBigFace(items.side1, indexes.s1, 'PREMIUM AD')}</group>
        <group rotation={[0, Math.PI, 0]} position={[0, 0, -dist]}>{mode === 'SHOP' ? renderBigFace(items.side3, indexes.s3, 'Category') : renderBigFace(items.side3, indexes.s3, 'PREMIUM AD')}</group>
        <group position={[dist, 0, 0]} rotation={[0, Math.PI / 2, 0]}>{mode === 'SHOP' ? renderBigFace(items.side2, indexes.s2, 'Category') : renderNormalFace(items.side2, indexes.s2)}</group>
        <group position={[-dist, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>{mode === 'SHOP' ? renderBigFace(items.side4, indexes.s4, 'Category') : renderNormalFace(items.side4, indexes.s4)}</group>
        
        <group position={[0, dist, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          {mode === 'SHOP' ? renderTopFace() : (
            <group>
              <Text position={[0, 0.3, 0.1]} fontSize={0.5} color={topTextColor} fontWeight="bold">AD Cube</Text>
              <Text position={[0, -0.5, 0.1]} fontSize={0.2} color="white">Check QR Code Below! 👇</Text>
            </group>
          )}
        </group>
        
        {/* 👇 [QR 코드 렌더링 부분] 이제 DreiImage 대신 Mesh를 사용함 */}
        <group position={[0, -dist, 0]} rotation={[Math.PI / 2, 0, 0]}>
           <Text fontSize={0.3} color="black" position={[0, 0.9, 0]} anchorX="center" anchorY="middle">Scan to Visit!</Text>
           {/* 배경 흰판 */}
           <mesh position={[0, 0, -0.01]}><planeGeometry args={[2.2, 2.2]} /><meshBasicMaterial color="white" /></mesh>
           
           {/* 생성된 QR 텍스처가 있으면 보여줌 */}
           {qrTexture && (
             <mesh position={[0, 0, 0.01]}>
               <planeGeometry args={[2, 2]} />
               <meshBasicMaterial map={qrTexture} transparent />
             </mesh>
           )}
        </group>
    </group>
  );
}

// 🔳 [메인 큐브 컴포넌트] 몸통과 내용을 합침
function FloatingCube({ items, mode, isDarkMode }) {
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current) meshRef.current.rotation.y += 0.002;
  });

  const boxSize = 3.5;
  const cubeColor = isDarkMode ? "#ffffff" : "#222222"; 
  const edgeColor = isDarkMode ? "#000000" : "#ffffff";

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <group ref={meshRef}>
        {/* 1. 상자 몸통 (항상 렌더링됨 - 로딩 없음) */}
        <RoundedBox args={[boxSize, boxSize, boxSize]} radius={0.1} smoothness={4}>
          <meshStandardMaterial attach="material-0" color={cubeColor} />
          <meshStandardMaterial attach="material-1" color={cubeColor} />
          <meshStandardMaterial attach="material-2" color="#111" />
          <meshStandardMaterial attach="material-3" color="#F0F0F0" />
          <meshStandardMaterial attach="material-4" color="#FF5252" />
          <meshStandardMaterial attach="material-5" color="#4ECDC4" />
        </RoundedBox>

        {/* 2. 외곽선 */}
        <mesh>
          <boxGeometry args={[boxSize, boxSize, boxSize]} />
          <meshBasicMaterial transparent opacity={0} />
          <Edges threshold={15} color={edgeColor} linewidth={2} />
        </mesh>

        {/* 3. 내용물 (이미지 로딩 중엔 잠깐 기다림) */}
        <Suspense fallback={null}>
          <CubeContent items={items} mode={mode} isDarkMode={isDarkMode} />
        </Suspense>
      </group>
    </Float>
  );
}

// 🎬 [최종 수출 컴포넌트]
export default function Ad3D({ isDarkMode, items, mode = 'AD', isMobile }) {
  // 다크모드 -> 검은 배경 / 라이트모드 -> 밝은 배경
  const bgStyle = isDarkMode 
    ? 'radial-gradient(circle at 50% 50%, #2b2b2b 0%, #000 100%)' 
    : 'radial-gradient(circle at 50% 50%, #f0f0f0 0%, #e0e0e0 100%)';

  const cameraZ = isMobile ? 11 : 8;

  return (
    <div style={{ width: '100%', height: isMobile ? '400px' : '500px', background: bgStyle, borderRadius: '20px', overflow: 'hidden', transition: 'background 0.3s ease', position: 'relative', zIndex: 1, boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
      <Canvas camera={{ position: [6, 3, cameraZ], fov: 40 }}>
        <ambientLight intensity={0.7} />
        <spotLight position={[10, 10, 10]} angle={0.3} intensity={1} />
        <pointLight position={[-10, -5, -5]} intensity={1} />
        {/* FloatingCube 내부에서 Suspense를 처리하므로 여기서는 바로 호출 */}
        <FloatingCube isDarkMode={isDarkMode} items={items} mode={mode} />
        <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI} />
      </Canvas>
    </div>
  );
}