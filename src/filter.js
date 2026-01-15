import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// 🧹 [도구] 텍스트 정규화 (공백만 제거)
const normalizeText = (text) => {
  return text.replace(/\s+/g, '').toLowerCase(); 
};

// 🛑 [1차: 절대 차단 블랙리스트]
// 텍스트는 여기서 100% 잡힙니다. (성공 확인됨)
const CRITICAL_KEYWORDS = [
  '살인', '살해', '청부', '암살', '도살', '난자', '토막', '시체', 
  '테러', '폭탄', '폭발물', '사제총', '화염병', '총기', '실탄', '수류탄', '테러리스트',
  '성폭행', '강간', '윤간', '강제추행', '성노예', '최음제', '발정제', '물뽕',
  '딥페이크', '지인능욕', '몰카', '도촬', '리벤지포르노', '초대남',
  '아동포르노', '페도', '로리', '쇼타', '근친', '수간', '능욕',
  '성매매', '조건만남', '원조교제', '조건녀', '조건남', '출장샵', '애인대행', 
  '키스방', '안마방', '오피', '립카페', '성매수', '매춘',
  '마약', '대마', '대마초', '떨', '고기', '아이스', '작대기', 
  '필로폰', '히로뽕', '메스암페타민', '펜타닐', '헤로인', '코카인', '엑스터시', 'LSD', 
  '졸피뎀', '프로포폴', '케타민', '사카린', '해피벌룬',
  '자살', '자해', '동반자살', '안락사', '손목긋기', '목매달기', '투신'
];

export const analyzeContent = async (text, imageBase64 = null, context = 'post') => {
  const cleanText = normalizeText(text || "");
  console.log(`🛡️ [AI 검사 시작] 입력값: "${text}"`);

  // =================================================
  // 1️⃣ [1차 여과기] 블랙리스트 (텍스트 즉시 차단)
  // =================================================
  const foundDanger = CRITICAL_KEYWORDS.find(k => cleanText.includes(k));
  if (foundDanger) {
    console.warn(`🚨 [1차 차단] 금지어 검출: ${foundDanger}`);
    return { isSafe: false, reason: `부적절한 단어("${foundDanger}")가 포함되어 있습니다.` };
  }

  // =================================================
  // 2️⃣ [AI 모델 분석] (Gemini 1.5 Flash)
  // =================================================
  try {
    // 🔥 [수정] 모델 이름을 가장 심플한 'gemini-1.5-flash'로 변경
    // 만약 이래도 404가 뜨면, 그건 진짜 '키' 문제라 코드로는 해결 불가함.
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    let prompt = `
      You are a strict safety officer.
      Analyze the text and image provided.
      
      [Rules]
      1. BLOCK(false): Nudity, Porn, Sexual content, Real Violence, Drugs.
      2. ALLOW(true): Daily life, Food, Pets (Cats/Dogs), Games.
      
      Input Text: "${text}"
      Context: ${context}
      
      Respond ONLY with this JSON format (No Markdown):
      { "isSafe": boolean, "reason": "Reason in Korean" }
    `;

    // 텍스트 포장
    let requestParts = [{ text: prompt }];

    if (imageBase64) {
      const base64Data = imageBase64.split(',')[1];
      requestParts.push({ inlineData: { data: base64Data, mimeType: "image/jpeg" } });
    }

    console.log("🤖 AI 모델 호출 중...");

    const result = await model.generateContent({
      contents: [{ role: "user", parts: requestParts }],
      safetySettings: safetySettings,
    });

    const response = await result.response;
    const textResponse = response.text();
    console.log("🤖 [AI 응답]:", textResponse);

    // 3️⃣ [2차 여과기] 구글 안전 센서
    if (response.candidates && response.candidates[0].safetyRatings) {
      const ratings = response.candidates[0].safetyRatings;
      const targetCategories = [
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT
      ];

      for (const rating of ratings) {
        if (targetCategories.includes(rating.category)) {
          // MEDIUM 이상이면 무조건 차단
          if (rating.probability === "HIGH" || rating.probability === "MEDIUM") {
            console.warn(`🚨 [2차 차단] 센서 감지: ${rating.category} (${rating.probability})`);
            return { isSafe: false, reason: "이미지 또는 텍스트에서 유해한 요소가 감지되었습니다." };
          }
        }
      }
    }

    // 4️⃣ [3차 여과기] JSON 파싱
    const startIndex = textResponse.indexOf('{');
    const endIndex = textResponse.lastIndexOf('}');
    
    if (startIndex === -1 || endIndex === -1) {
      throw new Error("JSON 형식을 찾을 수 없음");
    }

    const jsonString = textResponse.substring(startIndex, endIndex + 1);
    return JSON.parse(jsonString);

  } catch (error) {
    console.error("🚨 AI 처리 중 오류:", error);
    
    // 🔥 [보안 최우선] AI가 고장 나면?
    // "어쩔 수 없다. 이미지가 있으면 위험하니 무조건 막는다."
    if (imageBase64) {
        return { isSafe: false, reason: "AI 연결 실패: 이미지를 검사할 수 없습니다. (잠시 후 다시 시도해주세요)" };
    }
    
    // 텍스트만 있으면 1차 필터 통과했으니 봐줌.
    return { isSafe: true, reason: "AI 지연 (텍스트만 임시 승인)" };
  }
};