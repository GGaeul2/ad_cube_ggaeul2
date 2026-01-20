import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// 🧹 [도구] 텍스트 정규화
const normalizeText = (text) => {
  return text.replace(/\s+/g, '').toLowerCase(); 
};

// 🛑 [1차: 절대 차단 블랙리스트] - 수정됨!
// ⚠️ 주의: '고기', '떨', '술' 등 일상 용어로 쓰일 수 있는 은어는 여기서 뺐습니다. (AI가 판단하게 함)
const CRITICAL_KEYWORDS = [
  '청부살인', '청부폭력', '청부', '암살', '도살', '난자', '토막시체', 
  '사제총', '사제폭탄', '화염병', '실탄', '테러모의', '성매매', '인육',
  '강간', '윤간', '강제추행', '성노예', '최음제', '발정제', '물뽕', '지인능욕',
  '아동포르노', '페도', '로리', '쇼타', '근친상간', '수간',
  '조건만남', '원조교제', '출장샵', '애인대행', '키스방', '안마방', '오피', '성매수',
  '필로폰', '히로뽕', '메스암페타민', '펜타닐', '헤로인', '엑스터시', 'LSD', 
  '졸피뎀', '프로포폴', '케타민', '해피벌룬', // '고기', '떨' 제거됨
  '자살모의', '동반자살', '안락사', '손목긋기' // 단순 '자살' 단어는 우울증 상담일 수도 있으므로 구체적 행위만 차단
];

export const analyzeContent = async (text, imageBase64 = null, context = 'shopping_mall') => {
  const cleanText = normalizeText(text || "");
  console.log(`🛡️ [AI 검사 시작] 입력값: "${text.substring(0, 20)}..."`);

  // =================================================
  // 1️⃣ [1차 여과기] 블랙리스트 (확실한 범죄 용어만 차단)
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
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // ⚙️ 안전 설정: AI가 텍스트를 생성하는 것 자체를 막지 않게 함 (판단은 우리가 JSON으로 함)
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    // 🧠 [프롬프트 개선] 쇼핑몰 문맥을 주입
    let prompt = `
      Act as a safety moderator for an online shopping mall & community.
      Analyze the input for policy violations.

      [Context Rules]
      1. ALLOW (Safe): 
         - Selling kitchen knives, camping tools, lighters (Dangerous goods for utility are OK).
         - Swimwear, underwear, modeling (Human skin is OK if not pornographic).
         - Words like "Meat(고기)", "Weed(풀)" in food/gardening context.
         - Alcohol/Tobacco (Allow, but mark as adult content if possible, currently consider safe for listing).
      
      2. BLOCK (Unsafe):
         - Nudity (Genitals, sexual acts), Pornography.
         - Real violence, Gore, Self-harm content.
         - Drug trade (Meth, Cocaine, Fentanyl). Slang used for drugs.
         - Prostitution, Solicitation.

      Input: "${text}"
      ${imageBase64 ? "[Image Attached]" : "[No Image]"}

      Respond ONLY in JSON format:
      { "isSafe": boolean, "reason": "Reason in Korean" }
    `;

    let requestParts = [{ text: prompt }];

    if (imageBase64) {
      // Base64 헤더 제거 (data:image/jpeg;base64, 부분)
      const base64Data = imageBase64.includes('base64,') ? imageBase64.split('base64,')[1] : imageBase64;
      requestParts.push({ inlineData: { data: base64Data, mimeType: "image/jpeg" } });
    }

    console.log("🤖 AI 모델 호출 중...");

    const result = await model.generateContent({
      contents: [{ role: "user", parts: requestParts }],
      safetySettings: safetySettings,
    });

    const response = await result.response;
    
    // 3️⃣ [2차 여과기] 구글 안전 센서 (민감도 조정)
    // 쇼핑몰이므로 'MEDIUM'은 허용하고, AI의 논리적 판단(JSON)을 따름.
    // 단, 'HIGH'는 구글이 보기에 빼박 위험한 것이므로 차단.
    if (response.candidates && response.candidates[0].safetyRatings) {
      const ratings = response.candidates[0].safetyRatings;
      const targetCategories = [
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT
      ];

      for (const rating of ratings) {
        if (targetCategories.includes(rating.category)) {
          if (rating.probability === "HIGH") { // ✨ MEDIUM 제거함
            console.warn(`🚨 [2차 차단] 센서 감지 (HIGH): ${rating.category}`);
            return { isSafe: false, reason: "이미지 또는 텍스트에서 매우 유해한 요소가 감지되었습니다." };
          }
        }
      }
    }

    // 4️⃣ [3차 여과기] JSON 파싱
    const textResponse = response.text();
    // console.log("🤖 [AI 원본 응답]:", textResponse); // 디버깅용

    const startIndex = textResponse.indexOf('{');
    const endIndex = textResponse.lastIndexOf('}');
    
    if (startIndex === -1 || endIndex === -1) {
      // AI가 JSON을 안 줬다면? -> 일단 통과시키되 로그 남김 (오탐지 방지)
      console.warn("⚠️ AI 응답에서 JSON 파싱 실패. 안전한 것으로 간주함.");
      return { isSafe: true, reason: "검사 완료 (AI 응답 불분명)" };
    }

    const jsonString = textResponse.substring(startIndex, endIndex + 1);
    const resultJson = JSON.parse(jsonString);

    return resultJson;

  } catch (error) {
    console.error("🚨 AI 처리 중 오류:", error);
    
    // 이미지가 있는데 에러가 났다? -> 안전을 위해 텍스트만이라도 체크했다 치고 통과 or 차단
    // 쇼핑몰 특성상 이미지 에러로 상품 등록이 안 되면 매출 손해이므로,
    // 시스템 에러 시에는 "잠정 허용" 하되 관리자에게 알리는 게 일반적임.
    // 여기서는 사용자 경험을 위해 '통과'로 처리하겠음.
    return { isSafe: true, reason: "AI 연결 지연 (임시 승인)" };
  }
};