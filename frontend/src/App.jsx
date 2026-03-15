import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import {
  User,
  MessageSquare,
  Database,
  ChevronRight,
  Languages,
  CheckCircle2,
  ArrowLeft,
  ClipboardCheck,
  Send,
  Loader2,
  Stethoscope,
  Activity,
  Moon,
  Utensils,
  Brain,
  History,
  Sparkles,
  UserCircle,
  AlertTriangle
} from 'lucide-react';
import questionnaireData from './data/questionnaireData.json';
import bodyMapSvg from './assets/body-map.svg';
import meninbloxIcon from './assets/meninblox-icon.png';
import catAbdPain from './assets/cat-abd-pain.png';
import catIndigestion from './assets/cat-indigestion.png';
import catVomiting from './assets/cat-vomiting.png';
import catJaundice from './assets/cat-jaundice.png';
import catConstipation from './assets/cat-constipation.png';
import catDiarrhea from './assets/cat-diarrhea.png';

const CATEGORY_IMAGES = {
  CAT001: catAbdPain,
  CAT002: catIndigestion,
  CAT003: catVomiting,
  CAT004: catDiarrhea,
  CAT005: catJaundice,
  CAT006: catConstipation,
};

const App = () => {
  // --- States ---
  const [lang, setLang] = useState('ko');
  const [view, setView] = useState('init'); // init, consent, user_confirm_written, selection, rule_intro, rule_categories, rule_survey, chat_intro, chat_survey, results
  const [modalStep, setModalStep] = useState(1); // 1: Language, 2: User Info
  const [showUserModal, setShowUserModal] = useState(true);
  const [userData, setUserData] = useState({ id: '', gender: '', age: '' });
  const [patientInfo, setPatientInfo] = useState({ name: '', gender: '', birthdate: '', phoneCode: window.location.pathname.startsWith('/id') ? '+62' : '+82', phone: '' });
  const [patientInfoErrors, setPatientInfoErrors] = useState({ name: '', birthdate: '', phone: '' });
  const [bdPicker, setBdPicker] = useState(null); // null | 'year' | 'month' | 'day'
  const [showPhoneCodePicker, setShowPhoneCodePicker] = useState(false);
  const [bdParts, setBdParts] = useState({ y: '', m: '', d: '' }); // 연/월/일 개별 상태
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answers, setAnswers] = useState({});
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [redFlagTriggered, setRedFlagTriggered] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [input, setInput] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [questionHistory, setQuestionHistory] = useState([]); // 질문 히스토리 추가
  const [pendingSurveyFinish, setPendingSurveyFinish] = useState(false); // 문진 완료 대기 상태
  const [chatDisabled, setChatDisabled] = useState(false); // 채팅 비활성화 상태
  const [activeSurveyKey, setActiveSurveyKey] = useState(null); // 'rule' | 'chat' | 'survey' | null
  const [completedSurveyKeys, setCompletedSurveyKeys] = useState([]); // ['rule', 'chat', 'survey']
  const [surveyOrder, setSurveyOrder] = useState([]); // 시작 순서: e.g. ['rule'] or ['chat', 'rule']
  const [showNextStepPopup, setShowNextStepPopup] = useState(false); // 두 문진 완료 후 설문조사 안내 팝업
  const [expandedGuideStep, setExpandedGuideStep] = useState(null); // null | 0 | 1 | 2
  const [consentChecked, setConsentChecked] = useState(false); // 동의서 체크
  // 라우트 모드: null(기본), 'ko', 'id'
  const routeMode = useMemo(() => {
    const p = window.location.pathname;
    if (p === '/ko' || p.startsWith('/ko/')) return 'ko';
    if (p === '/id' || p.startsWith('/id/')) return 'id';
    return null;
  }, []);
  const chatEndRef = useRef(null);
  const chatMessageCountRef = useRef(0);
  const finishSurveyRef = useRef(null); // finishSurvey 함수 참조용

  // 백엔드 API URL (프로덕션: VITE_API_URL, 로컬: Vite 프록시)
  const API_URL = import.meta.env.VITE_API_URL || '';

  // 라우트 모드에 따라 언어 자동 설정 + 언어 선택 모달 건너뜀
  useEffect(() => {
    if (routeMode === 'ko') {
      setLang('ko');
      setShowUserModal(false);
      setView('consent');
    }
    if (routeMode === 'id') {
      setLang('id');
      setShowUserModal(false);
      setView('consent');
    }
  }, [routeMode]);

  // 뷰 전환 시 스크롤 초기화 (paint 전에 실행하여 깜빡임 방지)
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  // 50/50 균등 배정: localStorage 카운터로 교대 (홀수=rule, 짝수=chat)
  const assignFirstSurvey = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/assign-survey?mode=${routeMode}`);
      const data = await res.json();
      return data.firstSurvey;
    } catch {
      // 서버 오류 시 로컬 폴백
      const key = `survey_counter_${routeMode}`;
      const count = parseInt(localStorage.getItem(key) || '0', 10) + 1;
      localStorage.setItem(key, String(count));
      return count % 2 === 1 ? 'rule' : 'chat';
    }
  }, [routeMode, API_URL]);

  // 데이터 파싱
  const categories = useMemo(() =>
    (questionnaireData.Category || []).filter(c => c.is_active),
    []
  );

  const questions = useMemo(() =>
    (questionnaireData.Question || []).filter(q => q.is_active),
    []
  );

  const options = useMemo(() => questionnaireData.Option || [], []);
  const flowLogic = useMemo(() => questionnaireData.FlowLogic || [], []);
  const responseTypes = useMemo(() => questionnaireData.ResponseType || [], []);

  // 질문별 옵션 매핑
  const optionsByQuestion = useMemo(() => {
    return options.reduce((acc, opt) => {
      if (!acc[opt.question_id]) acc[opt.question_id] = [];
      acc[opt.question_id].push(opt);
      return acc;
    }, {});
  }, [options]);

  // ResponseType 매핑 (is_multiple 여부)
  const responseTypeMap = useMemo(() => {
    return responseTypes.reduce((acc, rt) => {
      acc[rt.type_id] = rt.is_multiple;
      return acc;
    }, {});
  }, [responseTypes]);

  // 질문별 Flow 매핑
  const flowsByQuestion = useMemo(() => {
    return flowLogic.reduce((acc, flow) => {
      if (!acc[flow.from_question_id]) acc[flow.from_question_id] = [];
      acc[flow.from_question_id].push(flow);
      return acc;
    }, {});
  }, [flowLogic]);

  // --- Translations ---
  const t = {
    ko: {
      selectLang: "실증을 진행할 언어를 선택해주세요.",
      onboarding: "실증 대상자 정보 입력",
      id: "대상자 ID",
      age: "나이",
      gender: "성별",
      male: "남성",
      female: "여성",
      next: "다음",
      previous: "이전",
      back: "뒤로",
      start: "시작하기",
      ruleMode: "룰 베이스 문진",
      chatMode: "채팅형 문진",
      ruleDesc: "증상 카테고리를 선택하여 단계별 문진을 진행합니다.",
      chatDesc: "AI와 자유로운 대화를 통해 문진을 진행합니다.",
      categories: "증상을 선택해주세요",
      finish: "문진 완료",
      processing: "데이터를 분석하여 결과를 생성 중입니다...",
      resultTitle: "최종 문진 결과",
      historyView: "참여 내역 (Rule/Chat)",
      analysisResult: "AI 종합 분석 보고서",
      backToStart: "초기 화면으로",
      chatAiEnd: "문진에 필요한 모든 정보가 수집되었습니다. 분석 결과 페이지로 이동합니다.",
      aiAssistant: "AI 문진 어시스턴트",
      typeMessage: "메시지를 입력하세요...",
      redFlagWarning: "⚠️ 위험 신호가 감지되었습니다",
      redFlagMessage: "즉시 응급실 방문을 권장드립니다. 현재 증상은 긴급한 의료 조치가 필요할 수 있습니다.",
      redFlagBannerMessage: "위험 신호가 감지되었습니다. 최종 결과에서 확인하실 수 있습니다. 문진을 계속 진행합니다.",
      subjectId: "피험자 ID",
      demographics: "인구통계",
      language: "언어",
      dataPoint: "데이터 포인트",
      backToLanguage: "언어 선택으로",
      backToMethods: "방법 선택으로",
      backToCategories: "카테고리 선택으로 돌아가기",
      disclaimer: "본 분석은 AI 기반 참고 정보이며 의료 진단이 아닙니다. 정확한 진단과 치료를 위해서는 반드시 의료기관을 방문하여 전문의 상담을 받으시기 바랍니다.",
      disclaimerTitle: "주의사항",
      selectMethodTitle: "원하시는 문진 방식을 선택하세요",
      selectMethodDesc: "본 실증은 룰 기반과 대화 기반의 문법 및 반응 차이를 분석합니다.",
      onboardingDesc: "실증 진행을 위해 기본 정보를 입력해 주세요.",
      goToResults: "결과 페이지로 이동",
      chatEnded: "문진이 종료되었습니다.",
      aiTyping: "AI가 응답 중...",
      analyzingResult: "AI 분석 결과를 생성하는 중...",
      analyzingSymptoms: "증상을 종합적으로 분석하고 있습니다",
      patientInfoTitle: "실증에 참여해주신 환자 분의\n정보를 입력해주세요",
      patientInfoDesc: "입력하신 정보로 예약 정보를 확인합니다.",
      name: "이름",
      namePlaceholder: "홍길동",
      birthdate: "생년월일",
      phone: "휴대폰 번호",
      singleSelectHint: "가장 알맞은 선택지를 하나만 골라주세요.",
      multiSelectHint: "해당하는 선택지를 모두 골라주세요.",
      errNameRequired: "이름을 입력해주세요.",
      errNameTooLong: "이름은 100자 이내로 입력해주세요.",
      errBirthdateRequired: "생년월일을 선택해주세요.",
      errBirthdateFuture: "생년월일은 오늘 이전 날짜여야 합니다.",
      errBirthdateAge: "만 18세 이상 100세 이하만 참여 가능합니다.",
      errPhoneRequired: "휴대폰 번호를 입력해주세요.",
      errPhoneInvalid: "올바른 전화번호 형식으로 입력해주세요. (숫자 8자리 이상)",
      headerSubtitle: "소화기내과 문진 솔루션",
      consentBadge: "연구 참여 동의",
      consentTitle: "정보 제공 동의가\n필요합니다",
      consentSubtitle: "수집된 정보는 서비스 이외 다른 용도로 사용되지 않습니다.",
      consentCheckbox: "위 내용을 모두 읽었으며 동의합니다",
      consentButton: "동의하고 계속하기",
      genderLabel: "성별",
      yearLabel: "년도", monthLabel: "월", dayLabel: "일",
      yearPlaceholder: "년도 선택", monthPlaceholder: "월 선택", dayPlaceholder: "일 선택",
      yearSuffix: "년", monthSuffix: "월", daySuffix: "일",
      guideParticipateBtn: "참여하기",
      guideHeroSuffix: "님, 참여해주셔서 감사합니다.",
      guideHeroLine1: "님,",
      guideHeroLine2: "참여해주셔서 감사합니다.",
      guideHeroLine3: "",
      guideSubDesc: "선택형 문진, 채팅 문진과 사용자 경험을 확인합니다.",
      guideSameSymptomNotice: "선택형 문진과 채팅 문진은 반드시 같은 증상으로 진행해 주세요.",
      guideTimeNote: "약 <b>15-20분</b> 소요됩니다.",
      guideStepsTitle: "참여 방법 · 3단계",
      guideStep1Label: "선택형 문진", guideStep1Desc: "위장관 증상에 대해 선택형 질문에 답합니다.",
      guideStep2Label: "채팅 문진",   guideStep2Desc: "AI와 대화 형식으로 증상을 상담합니다.",
      guideStep3Label: "설문조사",    guideStep3Desc: "서비스 사용 경험과 만족도를 작성합니다.",
      guidePreviewLabel: "예시 화면",
      guidePreviewQ1: "복통이 있으신가요?", guidePreviewA1: "예, 있습니다", guidePreviewA2: "아니오, 없습니다",
      guidePreviewQ2: "통증 위치를 선택해주세요.",
      guidePreviewLoc: ["상복부","하복부","좌측","우측"],
      guidePreviewAiMsg1: "안녕하세요. 어떤 증상으로 오셨나요?",
      guidePreviewUserMsg: "3일 전부터 복통이 있어요.",
      guidePreviewAiMsg2: "통증이 어느 부위에서 느껴지시나요?",
      guidePreviewSurveyQ: "AI 문진 결과가 도움이 되었나요?",
      guidePreviewScaleLow: "전혀 아니다", guidePreviewScaleHigh: "매우 그렇다",
      guidePreviewOpinionTitle: "추가 의견", guidePreviewOpinionPlaceholder: "자유롭게 작성해주세요...",
      guideRewardTitle: "리워드 안내",
      guideRewardThanks: "연구에 참여해주셔서 감사합니다.",
      guideRewardDesc: "아래 3가지를 모두 완료하신 분께 리워드가 지급됩니다.",
      guideComplete1: "선택형 문진 완료", guideComplete2: "채팅 문진 완료", guideComplete3: "설문조사 완료",
      guideNoteTitle: "안내 사항", guideNoteText: "본 결과는 의료 진단이 아닌 참고 정보입니다.",
      guidePrivacyTitle: "개인정보", guidePrivacyText: "수집 정보는 연구 목적에만 사용됩니다.",
      resultsTitle: "문진 결과",
      ageSuffix: "세",
      diffDiagnosisLabel: "감별 진단",
      symptomSummaryLabel: "증상 요약",
      redFlagsLabel: "위험 신호",
      evidenceLabel: "근거",
      patientEduLabel: "환자 안내",
      noResultText: "분석 결과를 불러올 수 없습니다.",
      myAnswersLabel: "내 답변 보기",
      analyzingBtn: "결과 분석 중...",
      surveyParticipateBtn: "설문조사 참여하기",
      nextChatBtn: "채팅 문진 하러가기",
      nextRuleBtn: "선택형 문진 하러가기",
      ruleIntroTitle: "선택형 문진",
      ruleIntroDesc: "소화기 증상과 관련된 질문들을 보기에서 선택하는 방식으로 진행됩니다. 증상의 위치, 특성, 동반 증상 등을 순서대로 답변해 주세요.",
      ruleIntroBullet1: "객관식 선택 방식",
      ruleIntroBullet2: "약 5~10분 소요",
      ruleIntroBullet3: "총 10여 개의 질문",
      chatIntroTitle: "채팅 문진",
      chatIntroDesc: "AI 소화기내과 전문의와 대화하듯 증상을 자유롭게 설명해 주세요. AI가 적절한 질문을 통해 증상을 파악합니다.",
      chatIntroBullet1: "대화형 AI 문진",
      chatIntroBullet2: "약 5~10분 소요",
      chatIntroBullet3: "자유로운 증상 서술",
      introStartBtn: "문진 시작하기",
    },
    vn: {
      selectLang: "Vui lòng chọn ngôn ngữ để tiến hành xác minh.",
      onboarding: "Nhập thông tin đối tượng xác minh",
      id: "ID đối tượng",
      age: "Tuổi",
      gender: "Giới tính",
      male: "Nam",
      female: "Nữ",
      next: "Tiếp theo",
      previous: "Trước",
      back: "Quay lại",
      start: "Bắt đầu",
      ruleMode: "Khảo sát dựa trên quy tắc",
      chatMode: "Khảo sát qua trò chuyện",
      ruleDesc: "Chọn danh mục triệu chứng và tiến hành khảo sát từng bước.",
      chatDesc: "Tiến hành khảo sát thông qua trò chuyện tự do với AI.",
      categories: "Chọn danh mục khảo sát",
      finish: "Hoàn thành",
      processing: "Đang phân tích dữ liệu và tạo kết quả...",
      resultTitle: "Kết quả khảo sát cuối cùng",
      historyView: "Lịch sử tham gia (Rule/Chat)",
      analysisResult: "Báo cáo phân tích tổng hợp AI",
      backToStart: "Về màn hình chính",
      chatAiEnd: "Tất cả thông tin cần thiết đã được thu thập. Đang chuyển đến trang kết quả.",
      aiAssistant: "Trợ lý khảo sát AI",
      typeMessage: "Nhập tin nhắn...",
      redFlagWarning: "⚠️ Phát hiện tín hiệu nguy hiểm",
      redFlagMessage: "Vui lòng đến phòng cấp cứu ngay lập tức.",
      redFlagBannerMessage: "Tín hiệu nguy hiểm đã được phát hiện. Bạn có thể kiểm tra trong kết quả cuối cùng. Tiếp tục khảo sát.",
      subjectId: "ID Chủ thể",
      demographics: "Nhân khẩu học",
      language: "Ngôn ngữ",
      dataPoint: "Điểm dữ liệu",
      backToLanguage: "Về lựa chọn ngôn ngữ",
      backToMethods: "Về lựa chọn phương pháp",
      backToCategories: "Quay lại lựa chọn danh mục",
      disclaimer: "Phân tích này chỉ là thông tin tham khảo dựa trên AI và không phải là chẩn đoán y tế. Để có chẩn đoán và điều trị chính xác, vui lòng đến cơ sở y tế và tham khảo ý kiến bác sĩ chuyên khoa.",
      disclaimerTitle: "Lưu ý",
      selectMethodTitle: "Vui lòng chọn phương pháp khảo sát",
      selectMethodDesc: "Nghiên cứu này phân tích sự khác biệt về ngữ pháp và phản ứng giữa khảo sát dựa trên quy tắc và khảo sát qua trò chuyện.",
      onboardingDesc: "Vui lòng nhập thông tin cơ bản để tiến hành xác minh.",
      goToResults: "Pergi ke halaman hasil",
      chatEnded: "Survei telah selesai.",
      aiTyping: "AI đang trả lời...",
      analyzingResult: "Đang tạo kết quả phân tích AI...",
      analyzingSymptoms: "Đang phân tích triệu chứng một cách toàn diện",
      patientInfoTitle: "Vui lòng nhập thông tin\nbệnh nhân đã đặt lịch",
      patientInfoDesc: "Chúng tôi sẽ xác minh thông tin đặt lịch bằng thông tin bạn nhập.",
      name: "Họ và tên",
      namePlaceholder: "Họ và tên",
      birthdate: "Ngày sinh",
      phone: "Số điện thoại",
      singleSelectHint: "Pilih satu jawaban yang paling sesuai.",
      multiSelectHint: "Pilih semua yang sesuai.",
      errNameRequired: "Vui lòng nhập họ và tên.",
      errNameTooLong: "Họ và tên không được vượt quá 100 ký tự.",
      errBirthdateRequired: "Vui lòng chọn ngày sinh.",
      errBirthdateFuture: "Ngày sinh phải trước ngày hôm nay.",
      errBirthdateAge: "Chỉ những người từ 18 đến 100 tuổi mới có thể tham gia.",
      errPhoneRequired: "Vui lòng nhập số điện thoại.",
      errPhoneInvalid: "Vui lòng nhập số điện thoại hợp lệ. (tối thiểu 8 chữ số)"
    },
    id: {
      selectLang: "Silakan pilih bahasa untuk melanjutkan verifikasi.",
      onboarding: "Masukkan Informasi Subjek Verifikasi",
      id: "ID Subjek",
      age: "Usia",
      gender: "Jenis Kelamin",
      male: "Laki-laki",
      female: "Perempuan",
      next: "Berikutnya",
      previous: "Sebelumnya",
      back: "Kembali",
      start: "Mulai",
      ruleMode: "Survei Berbasis Aturan",
      chatMode: "Survei Berbasis Chat",
      ruleDesc: "Pilih kategori gejala dan lakukan survei langkah demi langkah.",
      chatDesc: "Lakukan survei melalui percakapan bebas dengan AI.",
      categories: "Silakan pilih gejala Anda",
      finish: "Selesai",
      processing: "Menganalisis data dan membuat hasil...",
      resultTitle: "Hasil Survei Akhir",
      historyView: "Riwayat Sesi (Rule/Chat)",
      analysisResult: "Laporan Analisis Komprehensif AI",
      backToStart: "Kembali ke Awal",
      chatAiEnd: "Semua informasi yang diperlukan telah dikumpulkan. Menuju ke halaman hasil.",
      aiAssistant: "Asisten Survei AI",
      typeMessage: "Ketik pesan...",
      redFlagWarning: "⚠️ Sinyal bahaya terdeteksi",
      redFlagMessage: "Segera kunjungi ruang gawat darurat.",
      redFlagBannerMessage: "Sinyal bahaya telah terdeteksi. Anda dapat memeriksanya di hasil akhir. Melanjutkan survei.",
      subjectId: "ID Subjek",
      demographics: "Demografi",
      language: "Bahasa",
      dataPoint: "Titik Data",
      backToLanguage: "Kembali ke pilihan bahasa",
      backToMethods: "Kembali ke pilihan metode",
      backToCategories: "Kembali ke pilihan kategori",
      disclaimer: "Analisis ini hanya informasi referensi berbasis AI dan bukan diagnosis medis. Untuk diagnosis dan perawatan yang akurat, silakan kunjungi fasilitas medis dan konsultasikan dengan dokter spesialis.",
      disclaimerTitle: "Perhatian",
      selectMethodTitle: "Silakan pilih metode survei yang Anda inginkan",
      selectMethodDesc: "Penelitian ini menganalisis perbedaan tata bahasa dan respons antara survei berbasis aturan dan survei berbasis percakapan.",
      onboardingDesc: "Silakan masukkan informasi dasar untuk melanjutkan verifikasi.",
      goToResults: "Pergi ke halaman hasil",
      chatEnded: "Survei telah selesai.",
      aiTyping: "AI sedang merespons...",
      analyzingResult: "Membuat hasil analisis AI...",
      analyzingSymptoms: "Menganalisis gejala secara komprehensif",
      patientInfoTitle: "Masukkan informasi pasien\nyang berpartisipasi dalam verifikasi",
      patientInfoDesc: "Kami akan memverifikasi informasi pemesanan dengan data yang Anda masukkan.",
      name: "Nama",
      namePlaceholder: "Nama lengkap",
      birthdate: "Tanggal lahir",
      phone: "Nomor telepon",
      singleSelectHint: "Pilih satu jawaban yang paling sesuai.",
      multiSelectHint: "Pilih semua yang sesuai.",
      errNameRequired: "Mohon masukkan nama Anda.",
      errNameTooLong: "Nama tidak boleh lebih dari 100 karakter.",
      errBirthdateRequired: "Mohon pilih tanggal lahir.",
      errBirthdateFuture: "Tanggal lahir harus sebelum hari ini.",
      errBirthdateAge: "Hanya peserta berusia 18 hingga 100 tahun yang dapat berpartisipasi.",
      errPhoneRequired: "Mohon masukkan nomor telepon.",
      errPhoneInvalid: "Masukkan nomor telepon yang valid. (minimal 8 digit)",
      headerSubtitle: "Solusi Wawancara Gastroenterologi",
      consentBadge: "Persetujuan Penelitian",
      consentTitle: "Diperlukan\nPersetujuan Informasi",
      consentSubtitle: "Informasi yang dikumpulkan tidak akan digunakan untuk tujuan selain layanan ini.",
      consentCheckbox: "Saya telah membaca semua isi di atas dan menyetujuinya",
      consentButton: "Setuju dan Lanjutkan",
      genderLabel: "Jenis Kelamin",
      yearLabel: "Tahun", monthLabel: "Bulan", dayLabel: "Tanggal",
      yearPlaceholder: "Pilih tahun", monthPlaceholder: "Pilih bulan", dayPlaceholder: "Pilih tanggal",
      yearSuffix: "", monthSuffix: "", daySuffix: "",
      guideParticipateBtn: "Ikut Serta",
      guideHeroSuffix: ", terima kasih telah berpartisipasi.",
      guideHeroLine1: ",",
      guideHeroLine2: "Terima kasih telah berpartisipasi.",
      guideHeroLine3: "",
      guideSubDesc: "Kami mengkonfirmasi survei pilihan, wawancara chat, dan pengalaman pengguna.",
      guideSameSymptomNotice: "Survei pilihan dan wawancara chat harus dilakukan dengan gejala yang sama.",
      guideTimeNote: "Memerlukan sekitar <b>15-20 menit</b>.",
      guideStepsTitle: "Cara Berpartisipasi · 3 Langkah",
      guideStep1Label: "Survei Pilihan", guideStep1Desc: "Jawab pertanyaan pilihan tentang gejala gastrointestinal.",
      guideStep2Label: "Wawancara Chat", guideStep2Desc: "Konsultasikan gejala Anda dalam format percakapan dengan AI.",
      guideStep3Label: "Kuesioner",      guideStep3Desc: "Tulis pengalaman penggunaan dan kepuasan layanan.",
      guidePreviewLabel: "Contoh Tampilan",
      guidePreviewQ1: "Apakah Anda mengalami sakit perut?", guidePreviewA1: "Ya, ada", guidePreviewA2: "Tidak, tidak ada",
      guidePreviewQ2: "Pilih lokasi nyeri.",
      guidePreviewLoc: ["Perut atas","Perut bawah","Kiri","Kanan"],
      guidePreviewAiMsg1: "Halo. Apa yang membawa Anda ke sini?",
      guidePreviewUserMsg: "Saya mengalami sakit perut sejak 3 hari lalu.",
      guidePreviewAiMsg2: "Di bagian mana Anda merasakan nyeri?",
      guidePreviewSurveyQ: "Apakah hasil wawancara AI membantu Anda?",
      guidePreviewScaleLow: "Sama sekali tidak", guidePreviewScaleHigh: "Sangat membantu",
      guidePreviewOpinionTitle: "Pendapat Tambahan", guidePreviewOpinionPlaceholder: "Tulis dengan bebas...",
      guideRewardTitle: "Informasi Hadiah",
      guideRewardThanks: "Terima kasih telah berpartisipasi dalam penelitian.",
      guideRewardDesc: "Hadiah akan diberikan kepada peserta yang menyelesaikan ketiga hal berikut.",
      guideComplete1: "Survei Pilihan Selesai", guideComplete2: "Wawancara Chat Selesai", guideComplete3: "Kuesioner Selesai",
      guideNoteTitle: "Catatan", guideNoteText: "Hasil ini adalah informasi referensi, bukan diagnosis medis.",
      guidePrivacyTitle: "Privasi", guidePrivacyText: "Informasi yang dikumpulkan hanya digunakan untuk tujuan penelitian.",
      resultsTitle: "Hasil Wawancara",
      ageSuffix: " tahun",
      diffDiagnosisLabel: "Diagnosis Banding",
      symptomSummaryLabel: "Ringkasan Gejala",
      redFlagsLabel: "Tanda Bahaya",
      evidenceLabel: "Dasar Diagnosis",
      patientEduLabel: "Edukasi Pasien",
      noResultText: "Tidak dapat memuat hasil analisis.",
      myAnswersLabel: "Lihat Jawaban Saya",
      analyzingBtn: "Menganalisis...",
      surveyParticipateBtn: "Ikuti Kuesioner",
      nextChatBtn: "Ke Wawancara Chat",
      nextRuleBtn: "Ke Survei Pilihan",
      ruleIntroTitle: "Survei Pilihan",
      ruleIntroDesc: "Survei ini dilakukan dengan memilih jawaban dari pilihan yang tersedia terkait gejala gastrointestinal Anda. Jawablah pertanyaan tentang lokasi, sifat, dan gejala penyerta secara berurutan.",
      ruleIntroBullet1: "Format pilihan ganda",
      ruleIntroBullet2: "Sekitar 5–10 menit",
      ruleIntroBullet3: "Sekitar 10 pertanyaan",
      chatIntroTitle: "Wawancara Chat",
      chatIntroDesc: "Ceritakan gejala Anda dengan bebas seperti berbicara dengan dokter spesialis gastroenterologi AI. AI akan mengajukan pertanyaan yang tepat untuk memahami kondisi Anda.",
      chatIntroBullet1: "Wawancara AI berbasis percakapan",
      chatIntroBullet2: "Sekitar 5–10 menit",
      chatIntroBullet3: "Deskripsi gejala bebas",
      introStartBtn: "Mulai Wawancara",
    }
  };

  const curT = t[lang];

  // 언어에 따른 필드명 헬퍼 함수
  const getLocalizedField = (obj, fieldPrefix) => {
    if (!obj) return '';
    const suffix = lang === 'ko' ? '_ko' : lang === 'vn' ? '_vi' : '_id';
    return obj[`${fieldPrefix}${suffix}`] || obj[`${fieldPrefix}_ko`] || '';
  };

  // --- Functions ---
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  useEffect(() => {
    if (view === 'chat_survey' && chatMessages.length === 0) {
      const greeting = lang === 'ko'
        ? `안녕하세요!\n저는 MENINBLOX에서 개발한 소화기내과 AI Agent입니다.\n\n다음 내용들 어느 것에 해당하시나요?\n\n- 배가 아파요\n- 소화가 안돼요\n- 토를 했어요\n- 설사를 해요\n- 피부/눈이 노랗게 변했어요\n- 변을 잘 못봐요`
        : lang === 'vn'
          ? "Xin chào! Tôi là AI Agent tiêu hóa được phát triển bởi MENINBLOX. Hiện tại bạn cảm thấy khó chịu ở đâu nhất?"
          : `Halo!\nSaya adalah AI Agent gastroenterologi yang dikembangkan oleh MENINBLOX.\n\nApakah Anda mengalami salah satu dari berikut ini?\n\n- Sakit perut\n- Pencernaan tidak lancar\n- Mual / muntah\n- Diare\n- Kulit/mata menguning\n- Sulit buang air besar`;

      setChatMessages([{
        role: 'ai',
        content: greeting,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        streaming: false,
        isMarkdown: true
      }]);
      chatMessageCountRef.current = 1;
    }
  }, [view, lang, chatMessages.length]);

  // 다음 질문 찾기 로직
  const getNextQuestion = useCallback((questionId, selectedOpts) => {
    const flows = flowsByQuestion[questionId] || [];
    const sortedFlows = [...flows].sort((a, b) => a.priority - b.priority);

    for (const flow of sortedFlows) {
      if (flow.condition_value === 'ALWAYS') {
        return flow.to_question_id;
      }
      if (selectedOpts.includes(flow.condition_option_id)) {
        return flow.to_question_id;
      }
    }
    return 'END';
  }, [flowsByQuestion]);

  const startRuleSurvey = useCallback((cat) => {
    setSelectedCategory(cat);
    const firstQuestion = questions.find(
      q => q.category_id === cat.category_id && q.display_order === 1
    );
    setCurrentQuestion(firstQuestion);
    setView('rule_survey');
    setActiveSurveyKey('rule');
    setSurveyOrder(prev => prev.includes('rule') ? prev : [...prev, 'rule']);
    setSelectedOptions([]);
    setAnswers({});
    setQuestionHistory([]); // 히스토리 초기화
    setRedFlagTriggered(false); // Red Flag 초기화
  }, [questions]);

  const handleOptionSelect = useCallback((option) => {
    if (!currentQuestion) return;

    const responseType = responseTypes.find(rt => rt.type_id === currentQuestion.response_type_id);

    if (responseType?.is_multiple) {
      if (option.is_exclusive) {
        setSelectedOptions([option.option_id]);
      } else {
        setSelectedOptions(prev => {
          if (prev.includes(option.option_id)) {
            return prev.filter(id => id !== option.option_id);
          } else {
            const exclusiveSelected = prev.find(id => {
              const opt = options.find(o => o.option_id === id);
              return opt?.is_exclusive;
            });
            if (exclusiveSelected) {
              return [option.option_id];
            }
            return [...prev, option.option_id];
          }
        });
      }
    } else {
      setSelectedOptions([option.option_id]);
    }
  }, [currentQuestion, responseTypes, options]);

  const handleNextQuestion = useCallback(() => {
    if (selectedOptions.length === 0 || !currentQuestion) return;

    const questionOpts = optionsByQuestion[currentQuestion.question_id] || [];
    const selectedTexts = questionOpts
      .filter(opt => selectedOptions.includes(opt.option_id))
      .map(opt => getLocalizedField(opt, 'option_text'));

    // 현재 질문과 답변을 히스토리에 저장
    setQuestionHistory(prev => [...prev, {
      question: currentQuestion,
      selectedOptions: selectedOptions,
      selectedTexts: selectedTexts
    }]);

    setAnswers(prev => ({
      ...prev,
      [currentQuestion.question_id]: {
        question: getLocalizedField(currentQuestion, 'question_text'),
        answers: selectedTexts,
        is_red_flag: currentQuestion.is_red_flag
      }
    }));

    setHistoryData(prev => [...prev, {
      type: 'rule',
      q: getLocalizedField(currentQuestion, 'question_text'),
      a: selectedTexts.join(', ')
    }]);

    const nextQuestionId = getNextQuestion(currentQuestion.question_id, selectedOptions);

    if (nextQuestionId === 'ALERT_RED_FLAG') {
      // Red Flag 감지: 조용히 기록하고 문진 계속 진행 (배너 표시 안함)
      setRedFlagTriggered(true);

      // 현재 카테고리의 다음 질문으로 계속 진행
      const currentCategoryQuestions = questions
        .filter(q => q.category_id === selectedCategory?.category_id)
        .sort((a, b) => a.display_order - b.display_order);

      const currentIndex = currentCategoryQuestions.findIndex(q => q.question_id === currentQuestion.question_id);
      const nextQ = currentCategoryQuestions[currentIndex + 1];

      if (nextQ) {
        setCurrentQuestion(nextQ);
        setSelectedOptions([]);
      } else {
        checkUserInfoAndFinish();
      }
      return;
    }

    if (nextQuestionId === 'END') {
      checkUserInfoAndFinish();
      return;
    }

    const nextQ = questions.find(q => q.question_id === nextQuestionId);
    if (nextQ) {
      setCurrentQuestion(nextQ);
      setSelectedOptions([]);
    } else {
      checkUserInfoAndFinish();
    }
  }, [currentQuestion, selectedOptions, optionsByQuestion, getNextQuestion, questions, selectedCategory]);

  // 이전 질문으로 돌아가기
  const handlePreviousQuestion = useCallback(() => {
    if (questionHistory.length === 0) {
      // 첫 질문이면 카테고리 선택으로 돌아가기
      setView('rule_categories');
      setCurrentQuestion(null);
      setSelectedOptions([]);
      setAnswers({});
      setQuestionHistory([]);
      return;
    }

    // 마지막 히스토리 항목 가져오기 (이것이 돌아갈 질문)
    const lastHistory = questionHistory[questionHistory.length - 1];

    // 히스토리에서 마지막 항목 제거 (돌아갈 질문의 기록 제거)
    setQuestionHistory(prev => prev.slice(0, -1));

    // 답변에서 마지막 히스토리의 질문 ID 제거 (돌아갈 질문의 이전 답변 제거)
    setAnswers(prev => {
      const newAnswers = { ...prev };
      delete newAnswers[lastHistory.question.question_id];
      return newAnswers;
    });

    setHistoryData(prev => prev.slice(0, -1));

    // 이전 질문으로 이동 (마지막 히스토리의 질문으로)
    setCurrentQuestion(lastHistory.question);
    setSelectedOptions(lastHistory.selectedOptions);
  }, [questionHistory]);

  // 사용자 정보 확인 후 문진 완료
  const checkUserInfoAndFinish = useCallback(() => {
    setPendingSurveyFinish(false);
    if (finishSurveyRef.current) {
      finishSurveyRef.current();
    }
  }, []);

  const finishSurvey = useCallback(async () => {
    console.log('🎯 finishSurvey called', {
      selectedCategory: selectedCategory ? getLocalizedField(selectedCategory, 'category_name') : null,
      answersCount: Object.keys(answers).length,
      chatMessagesCount: chatMessages.length,
      redFlagTriggered,
      userData
    });

    console.log('📋 Current answers:', answers);
    console.log('💬 Current chatMessages:', chatMessages);

    setPendingSurveyFinish(false);
    setCompletedSurveyKeys(prev => {
      const next = activeSurveyKey && !prev.includes(activeSurveyKey) ? [...prev, activeSurveyKey] : prev;
      return next;
    });
    setActiveSurveyKey(null);
    setView('results');
    setIsProcessing(true);

    // API 분석 호출 (룰베이스 문진 또는 채팅 문진 완료 시)
    if (selectedCategory && Object.keys(answers).length > 0) {
      console.log('🔍 Starting AI analysis for rule-based questionnaire...');
      try {
        const responses = Object.values(answers);
        console.log('📤 Sending to API:', {
          category: getLocalizedField(selectedCategory, 'category_name'),
          responsesCount: responses.length,
          language: lang,
          redFlagTriggered
        });

        const response = await fetch(`${API_URL}/api/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            category: getLocalizedField(selectedCategory, 'category_name'),
            responses: responses,
            language: lang,
            gender: patientInfo.gender || userData.gender || 'unknown',
            age: userData.age || 'unknown',
            redFlagTriggered: redFlagTriggered,
            sessionId: userData.id || '',
            name: patientInfo.name || '',
            birthdate: patientInfo.birthdate || '',
            phone: `${patientInfo.phoneCode}${patientInfo.phone}`,
            surveyType: 'rule',
            chatHistory: [],
          })
        });

        console.log('📥 API response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('✅ AI analysis received:', data);
          setAiAnalysis(data.analysis);
        } else {
          const errorText = await response.text();
          console.error('❌ API response not OK:', response.status, errorText);
          setAiAnalysis(`API 호출 실패 (${response.status}): ${errorText}`);
        }
      } catch (error) {
        console.error('❌ Analysis error:', error);
        setAiAnalysis(`분석 중 오류가 발생했습니다: ${error.message}`);
      }
    } else if (chatMessages.length > 0) {
      console.log('💬 Chat session completed, calling AI analysis...');
      try {
        // 채팅 메시지를 responses 형식으로 변환
        const chatResponses = chatMessages
          .filter(m => m.role === 'user' || m.role === 'ai')
          .map((m, i) => ({
            question: m.role === 'user' ? `User message ${Math.floor(i / 2) + 1}` : `AI response ${Math.floor(i / 2) + 1}`,
            answers: m.content,
            is_red_flag: false
          }));

        const response = await fetch(`${API_URL}/api/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            category: '채팅형 문진',
            responses: chatResponses,
            language: lang,
            gender: patientInfo.gender || userData.gender || 'unknown',
            age: userData.age || 'unknown',
            redFlagTriggered: false,
            sessionId: userData.id || '',
            name: patientInfo.name || '',
            birthdate: patientInfo.birthdate || '',
            phone: `${patientInfo.phoneCode}${patientInfo.phone}`,
            surveyType: 'chat',
            chatHistory: chatMessages,
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Chat analysis received:', data);
          setAiAnalysis(data.analysis);
        } else {
          console.error('❌ Chat analysis API error:', response.status);
          setAiAnalysis('채팅 분석 중 오류가 발생했습니다.');
        }
      } catch (error) {
        console.error('❌ Chat analysis error:', error);
        setAiAnalysis(`채팅 분석 중 오류가 발생했습니다: ${error.message}`);
      }
    } else {
      console.warn('⚠️ No data to analyze', { selectedCategory, answers, chatMessages });
      setAiAnalysis('분석할 데이터가 없습니다.');
    }

    setTimeout(() => setIsProcessing(false), 2000);
  }, [selectedCategory, answers, lang, API_URL, redFlagTriggered, chatMessages, userData]);

  // finishSurvey를 ref에 저장
  useEffect(() => {
    finishSurveyRef.current = finishSurvey;
  }, [finishSurvey]);

  const handleChatSend = async () => {
    if (!input.trim() || isProcessing || chatDisabled) return;

    const userMsg = {
      role: 'user',
      content: input,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const currentInput = input;
    setInput('');
    setIsProcessing(true);

    // User 메시지 추가
    setChatMessages(prev => {
      chatMessageCountRef.current = prev.length + 1;
      return [...prev, userMsg];
    });
    setHistoryData(prev => [...prev, { type: 'chat', q: "User Input", a: currentInput }]);

    // AI placeholder 추가
    setChatMessages(prev => {
      chatMessageCountRef.current = prev.length + 1;
      return [
        ...prev,
        {
          role: 'ai',
          content: '',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          streaming: true
        }
      ];
    });

    try {
      console.log('📤 Sending chat message to backend:', currentInput);

      // 전체 채팅 히스토리 준비 (초기 인사 메시지 포함)
      const history = chatMessages
        .filter(m => !m.streaming) // 스트리밍 중인 메시지 제외
        .map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }));

      const response = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: currentInput,
          history: history,  // 전체 히스토리 포함
          language: lang,
          gender: patientInfo.gender || userData.gender || 'unknown',
          age: userData.age || 'unknown',
          sessionId: userData.id || 'guest'
        })
      });

      if (!response.ok) {
        console.error('❌ API response error:', response.status, response.statusText);
        throw new Error(`API 호출 실패: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(6));

              if (data.error) {
                throw new Error(data.error);
              }

              if (data.content) {
                fullResponse += data.content;
                // 스트리밍으로 마지막 메시지(AI) 업데이트
                setChatMessages(prev => {
                  const updated = [...prev];
                  const lastIndex = updated.length - 1;
                  if (lastIndex >= 0 && updated[lastIndex].role === 'ai') {
                    updated[lastIndex] = {
                      ...updated[lastIndex],
                      content: fullResponse,
                      streaming: true
                    };
                  }
                  return updated;
                });
              }

              if (data.done) {
                console.log('✅ Stream completed');
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', line);
            }
          }
        }
      }

      // ##INTERVIEW_DONE## 감지 → 결과 페이지로 자동 이동
      const interviewDonePattern = /##INTERVIEW_DONE##/gi;
      const hasRefToken = interviewDonePattern.test(fullResponse);

      if (hasRefToken) {
        console.log('✅ ##INTERVIEW_DONE## detected — navigating to results');
        fullResponse = fullResponse.replace(interviewDonePattern, '').trim();

        // 마지막 AI 메시지 업데이트 (채팅창엔 남기지 않아도 되지만 히스토리용)
        setChatMessages(prev => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (lastIndex >= 0 && updated[lastIndex].role === 'ai') {
            updated[lastIndex] = { ...updated[lastIndex], content: fullResponse, streaming: false };
          }
          return updated;
        });

        setChatDisabled(true);

        // 결과 페이지로 즉시 이동 후 분석 API 호출
        // (finishSurveyRef는 React 재렌더 후 최신 chatMessages를 가지므로 짧은 delay 후 호출)
        setTimeout(() => {
          if (finishSurveyRef.current) finishSurveyRef.current();
        }, 300);
      } else {
        // 스트리밍 종료 (마지막 AI 메시지)
        setChatMessages(prev => {
          const updated = [...prev];
          const lastIndex = updated.length - 1;
          if (lastIndex >= 0 && updated[lastIndex].role === 'ai') {
            updated[lastIndex] = {
              ...updated[lastIndex],
              streaming: false
            };
          }
          return updated;
        });
      }

      setHistoryData(prev => [...prev, { type: 'chat', q: "AI Response", a: fullResponse }]);

      // ref token이 발견되면 마크다운으로 표시된 최종 응답을 보여줌
      // 자동으로 결과 페이지로 이동하지 않음

    } catch (error) {
      console.error('❌ Chat error:', error);

      const errorMessage = lang === 'ko'
        ? "죄송합니다. 일시적인 오류가 발생했습니다. 다시 시도해주세요."
        : lang === 'vn'
          ? "Xin lỗi. Đã xảy ra lỗi tạm thời. Vui lòng thử lại."
          : "Maaf. Terjadi kesalahan sementara. Silakan coba lagi.";

      // 마지막 AI 메시지를 에러 메시지로 교체
      setChatMessages(prev => {
        const updated = [...prev];
        const lastIndex = updated.length - 1;
        if (lastIndex >= 0 && updated[lastIndex].role === 'ai' && updated[lastIndex].streaming) {
          updated[lastIndex] = {
            ...updated[lastIndex],
            content: errorMessage,
            streaming: false
          };
        }
        return updated;
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Component Parts ---

  const LanguageSelectionStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{curT.selectLang}</h3>
        <p className="text-sm text-slate-400 font-medium">Please select a language for the verification.</p>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {[
          { id: 'ko', label: '한국어 (Korean)', flag: '🇰🇷' },
          { id: 'id', label: 'Bahasa Indonesia (Indonesian)', flag: '🇮🇩' }
        ].map(l => (
          <button
            key={l.id}
            onClick={() => { setLang(l.id); setShowUserModal(false); setView('consent'); }}
            className="flex items-center justify-between p-5 rounded-[1.5rem] border-2 border-slate-50 bg-slate-50 hover:border-[#3D52D5] hover:bg-white transition-all group shadow-sm hover:shadow-md"
          >
            <span className="font-bold text-slate-700 flex items-center gap-3">
              <span className="text-xl">{l.flag}</span>
              {l.label}
            </span>
            <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-[#3D52D5] transform group-hover:translate-x-1 transition-transform" />
          </button>
        ))}
      </div>
    </div>
  );

  const UserInfoStep = React.memo(() => {
    const [localId, setLocalId] = useState(userData.id);
    const [localAge, setLocalAge] = useState(userData.age);
    const [localGender, setLocalGender] = useState(userData.gender);

    const handleSubmit = (e) => {
      e.preventDefault();
      if (localId && localGender && localAge) {
        console.log('📝 Updating user data:', { id: localId, age: localAge, gender: localGender });
        setUserData({ id: localId, age: localAge, gender: localGender });
        setShowUserModal(false);

        // 문진 완료 대기 중이면 finishSurvey 호출
        if (pendingSurveyFinish && finishSurveyRef.current) {
          console.log('✅ Calling finishSurvey after user info update');
          setPendingSurveyFinish(false);
          setTimeout(() => {
            finishSurveyRef.current();
          }, 100);
        }
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4">
        <button type="button" className="flex items-center gap-2 text-slate-400 font-bold text-xs hover:text-[#3D52D5] transition-colors" onClick={() => setModalStep(1)}>
          <ArrowLeft className="w-3 h-3" /> {curT.backToLanguage}
        </button>
        <div className="space-y-1">
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">{curT.onboarding}</h3>
          <p className="text-xs text-slate-400 font-medium">{curT.onboardingDesc}</p>
        </div>
        <div className="space-y-5">
          <div className="relative">
            <label className="text-[10px] font-black uppercase text-slate-400 absolute top-3 left-4">{curT.id}</label>
            <input
              required
              value={localId}
              onChange={e => setLocalId(e.target.value)}
              className="w-full pt-8 pb-3 px-4 bg-slate-50 border-2 border-transparent focus:border-[#3D52D5] focus:bg-white rounded-2xl outline-none font-bold transition-all"
              placeholder="Subject ID (e.g., SUB_001)"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="text-[10px] font-black uppercase text-slate-400 absolute top-3 left-4">{curT.age}</label>
              <input
                required
                type="number"
                value={localAge}
                onChange={e => setLocalAge(e.target.value)}
                className="w-full pt-8 pb-3 px-4 bg-slate-50 border-2 border-transparent focus:border-[#3D52D5] focus:bg-white rounded-2xl outline-none font-bold transition-all"
              />
            </div>
            <div className="relative">
              <label className="text-[10px] font-black uppercase text-slate-400 absolute top-3 left-4">{curT.gender}</label>
              <select
                required
                value={localGender}
                onChange={e => setLocalGender(e.target.value)}
                className="w-full pt-8 pb-3 px-4 bg-slate-50 border-2 border-transparent focus:border-[#3D52D5] focus:bg-white rounded-2xl outline-none font-bold appearance-none transition-all"
              >
                <option value="">Select</option>
                <option value="male">{curT.male}</option>
                <option value="female">{curT.female}</option>
              </select>
            </div>
          </div>
        </div>
        <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-lg shadow-xl shadow-slate-200 hover:bg-[#3D52D5] transition-all active:scale-[0.98]">
          {curT.start}
        </button>
      </form>
    );
  });

  // ── 복부 위치 Body Map ──────────────────────────────────────
  // SVG 원본 좌표 그대로 사용 (인라인 SVG로 렌더링하므로 보정 불필요)
  const ABDOMEN_ZONE_COORDS = [
    { displayOrder: 1, x: 115.424, y: 217,     w: 51.151, h: 79.627 }, // 상복부(명치)
    { displayOrder: 2, x: 59,      y: 217,     w: 51.151, h: 79.627 }, // 우상복부
    { displayOrder: 3, x: 171.849, y: 217,     w: 51.151, h: 79.627 }, // 좌상복부
    { displayOrder: 4, x: 59,      y: 299.791, w: 80.682, h: 87.537 }, // 우하복부
    { displayOrder: 5, x: 144.428, y: 299.791, w: 78.572, h: 87.537 }, // 좌하복부
  ];

  const AbdomenBodyMap = ({ opts, selectedOptions, onSelect }) => {
    const sortedOpts = [...opts].sort((a, b) => a.display_order - b.display_order);
    const zoneOpts   = sortedOpts.slice(0, 5);
    const fullAbdOpt = sortedOpts[5];
    const unknownOpt = sortedOpts[6];

    const isFullAbdomen = fullAbdOpt && selectedOptions.includes(fullAbdOpt.option_id);
    const isClear       = unknownOpt && selectedOptions.includes(unknownOpt.option_id);

    return (
      <div className="-space-y-16">
        {/* Body map: img + 같은 viewBox의 인라인 SVG를 정확히 겹침 */}
        <div className="relative w-full max-w-[270px] mx-auto" style={{ aspectRatio: '294/531' }}>
          {/* 배경 신체 이미지 */}
          <img src={bodyMapSvg} alt="복부 위치도" className="absolute inset-0 w-full h-full" draggable={false} />

          {/* 인터랙티브 SVG 오버레이 — 동일한 viewBox="0 0 294 531" */}
          <svg
            viewBox="0 0 294 531"
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: 'none' }}
          >
            {ABDOMEN_ZONE_COORDS.map((zone, i) => {
              const opt = zoneOpts[i];
              if (!opt) return null;
              const isHighlighted = !isClear && (isFullAbdomen || selectedOptions.includes(opt.option_id));
              return (
                <rect
                  key={opt.option_id}
                  x={zone.x} y={zone.y}
                  width={zone.w} height={zone.h}
                  rx={20}
                  fill={isHighlighted ? '#13F9EB' : '#A56B36'}
                  fillOpacity={isHighlighted ? 0.3 : 0.1}
                  stroke={isHighlighted ? '#00C1CD' : '#A08282'}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeDasharray="4 4"
                  style={{ pointerEvents: 'all', cursor: 'pointer', transition: 'fill 0.18s, stroke 0.18s' }}
                  onClick={() => onSelect(opt)}
                />
              );
            })}
          </svg>
        </div>

        {/* 전복부 / 모르겠다 버튼 */}
        <div className="relative z-10 max-w-lg mx-auto space-y-3 px-4">
        {[fullAbdOpt, unknownOpt].filter(Boolean).map(opt => {
          const isSelected = selectedOptions.includes(opt.option_id);
          return (
            <button
              key={opt.option_id}
              onClick={() => onSelect(opt)}
              className={`w-full px-5 py-4 border-2 rounded-2xl text-left transition-all active:scale-[0.99] flex items-center justify-between ${
                isSelected ? 'border-[#3D52D5] bg-[#EEF0FB]' : 'border-slate-200 bg-white hover:border-[#3D52D5]/60'
              }`}
            >
              <span className={`font-bold text-base ${isSelected ? 'text-[#3D52D5]' : 'text-slate-600'}`}>
                {getLocalizedField(opt, 'option_text')}
              </span>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                isSelected ? 'border-[#3D52D5]' : 'border-slate-300'
              }`}>
                {isSelected && <div className="w-3.5 h-3.5 rounded-full bg-[#3D52D5]" />}
              </div>
            </button>
          );
        })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-[#EEF0FB]">
      {/* Header */}
      <header className="h-16 bg-white/80 backdrop-blur-xl border-b sticky top-0 z-50 px-6 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-black tracking-tight text-base leading-none text-[#3D52D5]">MENINBLOX</span>
          <span className="text-[9px] font-bold text-slate-400 tracking-wide mt-0.5">{curT.headerSubtitle}</span>
        </div>

        <div className="flex items-center gap-4">
          {/* 언어 변경 — 라우트 모드에서는 숨김 */}
          {!routeMode && <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-100">
            {['ko', 'id'].map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${lang === l ? 'bg-white text-[#3D52D5] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>}

          {/* 진행 단계 O-O-O */}
          {(() => {
            const LABEL = { rule: curT.guideStep1Label, chat: curT.guideStep2Label, survey: curT.guideStep3Label };
            // 동적 순서: 먼저 시작한 survey가 첫번째, 나머지가 두번째, 설문조사 항상 마지막
            const first  = surveyOrder[0] || null;
            const second = surveyOrder[1] || (first ? (first === 'rule' ? 'chat' : 'rule') : null);
            const orderedKeys = [first, second, 'survey'];

            const activeLabel = activeSurveyKey ? LABEL[activeSurveyKey] : null;

            return (
              <div className="relative flex items-center -translate-y-1.5">
                <div className="flex items-center gap-1">
                  {orderedKeys.map((key, i) => {
                    const isDone   = key && completedSurveyKeys.includes(key);
                    const isActive = key && activeSurveyKey === key;
                    return (
                      <React.Fragment key={i}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isDone   ? 'bg-[#3D52D5] border-[#3D52D5]' :
                          isActive ? 'border-[#3D52D5] bg-[#EEF0FB]' :
                                     'border-slate-300 bg-white'
                        }`}>
                          {isDone ? (
                            <svg viewBox="0 0 12 10" fill="none" className="w-2.5 h-2.5">
                              <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : isActive ? (
                            <div className="w-2 h-2 rounded-full bg-[#3D52D5]" />
                          ) : null}
                        </div>
                        {i < orderedKeys.length - 1 && (
                          <div className={`w-4 h-px rounded-full transition-all ${isDone ? 'bg-[#3D52D5]' : 'bg-slate-200'}`} />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
                {activeLabel && (
                  <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 translate-y-1.5 text-[10px] font-black text-[#3D52D5] whitespace-nowrap">
                    {activeLabel}
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto px-6 max-w-6xl">

        {/* ── 동의서 ─────────────────────────────────────────── */}
        {view === 'consent' && (
          <div className="max-w-lg mx-auto animate-in fade-in duration-300 pb-32">

            {/* Title */}
            <div className="pt-6 pb-4 shrink-0">
              <div className="inline-flex items-center gap-2 bg-[#EEF0FB] text-[#3D52D5] text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full mb-4">
                <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3">
                  <path d="M8 1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zM6 6h2.5v6H10v1.5H6V12h1.5V7.5H6V6z" fill="currentColor"/>
                </svg>
                {curT.consentBadge}
              </div>
              <h2 className="text-2xl font-black text-slate-900 leading-tight mb-2">
                {curT.consentTitle.split('\n').map((line, i) => <React.Fragment key={i}>{line}{i === 0 && <br />}</React.Fragment>)}
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                {curT.consentSubtitle}
              </p>
            </div>

            {/* ── 스크롤 가능한 동의서 전문 ── */}
            <div className="max-h-[calc(100vh-28rem)] overflow-y-auto rounded-2xl border border-slate-100 bg-slate-50/60 p-5 custom-scrollbar">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">LEMBAR PERSETUJUAN MENGIKUTI PENELITIAN</p>
              <p className="text-sm font-bold text-slate-700 mb-1">Judul Penelitian:</p>
              <p className="text-sm text-slate-600 mb-4">Validasi Solusi Konsultasi Berbasis AI untuk Penyakit Gastrointestinal di Indonesia</p>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                Selamat pagi/siang/sore, Perkenalkan, kami adalah tim peneliti dari Sirka. Anda diundang untuk berpartisipasi dalam penelitian pilot project yang bertujuan menguji dan memvalidasi MediKoGPT, sebuah solusi konsultasi berbasis kecerdasan buatan (AI) untuk pasien dengan penyakit gastrointestinal di Indonesia. Penelitian ini merupakan kolaborasi antara Sirka dan MENINBLOX (MIB). Sebelum Anda memutuskan untuk berpartisipasi, mohon baca lembar informasi ini dengan saksama. Partisipasi Anda bersifat sukarela.
              </p>

              {[
                {
                  n: '1', title: 'Tujuan Penelitian',
                  content: 'Penelitian ini bertujuan untuk:\n• Menguji dan memvalidasi MediKoGPT sebagai solusi konsultasi berbasis AI untuk penyakit gastrointestinal\n• Mengukur tingkat akurasi dan kesesuaian hasil konsultasi AI dengan penilaian dokter\n• Mengumpulkan umpan balik pengguna terhadap pengalaman penggunaan platform MediKoGPT\n• Menghasilkan publikasi ilmiah yang berkontribusi pada perkembangan teknologi kesehatan digital di Indonesia'
                },
                {
                  n: '2', title: 'Prosedur Penelitian',
                  content: 'Jika Anda setuju untuk berpartisipasi, Anda akan diminta untuk:\n• Mengisi kuesioner melalui aplikasi web MediKoGPT\n• Memberikan informasi dasar: nama, jenis kelamin, nomor telepon, dan alamat email\n• Menjawab pertanyaan terkait gejala dan keluhan gastrointestinal Anda (pilihan ganda atau berbasis percakapan/chat)\n• Menerima hasil analisis dari platform MediKoGPT\n• Mengisi kuesioner preferensi dan kepuasan pengguna setelah menyelesaikan konsultasi\n\nProses pengisian kuesioner diperkirakan memakan waktu sekitar 10 menit.'
                },
                {
                  n: '3', title: 'Manfaat dan Risiko',
                  content: 'Manfaat:\n• Anda akan mendapatkan umpan balik awal terkait kondisi gastrointestinal Anda melalui platform AI\n• Anda berkontribusi pada pengembangan teknologi kesehatan digital yang dapat membantu banyak pasien di masa depan\n• Hasil penelitian ini akan dipublikasikan dalam jurnal ilmiah\n\nRisiko:\n• Hasil dari MediKoGPT bersifat informasi awal dan tidak menggantikan diagnosis atau konsultasi langsung dengan dokter\n• Segala keputusan medis harus tetap dikonsultasikan dengan tenaga kesehatan profesional'
                },
                {
                  n: '4', title: 'Kerahasiaan dan Perlindungan Data Pribadi',
                  content: 'Sirka berkomitmen penuh untuk menjaga kerahasiaan dan melindungi data pribadi Anda sesuai dengan Undang-Undang Perlindungan Data Pribadi Indonesia:\n• Data pribadi Anda hanya akan disimpan oleh tim Sirka dan tidak akan dibagikan kepada pihak ketiga manapun\n• Seluruh data akan diolah secara agregat dan anonim dalam analisis penelitian\n• Data hanya digunakan untuk tujuan ilmiah yang telah disepakati\n• Hasil penelitian yang dipublikasikan tidak akan mencantumkan informasi pribadi yang dapat mengidentifikasi Anda'
                },
                {
                  n: '5', title: 'Hak Anda sebagai Responden',
                  content: 'Anda memiliki hak untuk:\n• Menolak atau menarik diri dari penelitian ini kapan saja tanpa konsekuensi apapun\n• Mengajukan pertanyaan kepada tim peneliti terkait prosedur penelitian\n• Menerima insentif berupa saldo Gopay Rp35.000–50.000, apabila telah menyelesaikan seluruh rangkaian survei dalam penelitian ini'
                },
                {
                  n: '6', title: 'Publikasi Hasil Penelitian',
                  content: 'Hasil penelitian ini akan dipublikasikan dalam jurnal ilmiah untuk mendukung perkembangan ilmu pengetahuan dan teknologi kesehatan digital. Semua data yang dipublikasikan akan bersifat agregat dan tidak akan mencantumkan informasi pribadi yang dapat mengidentifikasi responden secara individual.'
                },
                {
                  n: '7', title: 'Informasi Kontak',
                  content: 'Jika Anda memiliki pertanyaan terkait penelitian ini, Anda dapat menghubungi:\n\nAnita Khairani T., S.Gz. MSc\nProduct Health Solution Manager Sirka\nEmail: anita@tns.health'
                },
                {
                  n: '8', title: 'Pernyataan Persetujuan',
                  content: 'Dengan mencentang kotak persetujuan dan melanjutkan ke kuesioner, saya menyatakan bahwa:\n• Saya telah membaca dan memahami informasi yang tercantum dalam lembar persetujuan ini\n• Saya memahami bahwa partisipasi saya bersifat sukarela dan saya dapat menarik diri kapan saja\n• Saya memahami bahwa data pribadi saya akan dilindungi dan tidak akan dibagikan kepada pihak ketiga\n• Saya memahami bahwa hasil penelitian akan dipublikasikan dalam jurnal ilmiah secara agregat dan anonim\n• Saya dengan sukarela menyetujui untuk berpartisipasi dalam penelitian ini'
                },
              ].map(sec => (
                <div key={sec.n} className="mb-5 last:mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full bg-[#3D52D5] text-white text-[10px] font-black flex items-center justify-center shrink-0">{sec.n}</span>
                    <p className="text-sm font-black text-slate-800">{sec.title}</p>
                  </div>
                  <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-line pl-7">{sec.content}</p>
                </div>
              ))}
            </div>

          </div>
        )}

        {view === 'user_confirm_written' && (
          <div className="max-w-lg mx-auto mt-4 animate-in fade-in duration-300 pb-28">

            {/* Back */}
            <button
              onClick={() => setView('consent')}
              className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-slate-100 transition-colors mb-6"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>

            {/* Title */}
            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-900 leading-tight mb-2 whitespace-pre-line">
                {curT.patientInfoTitle}
              </h2>
            </div>

            {/* 이름 */}
            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-800 mb-2">
                {curT.name}
              </label>
              <input
                type="text"
                placeholder={curT.namePlaceholder}
                maxLength={100}
                value={patientInfo.name}
                onChange={e => {
                  setPatientInfo(p => ({ ...p, name: e.target.value }));
                  if (patientInfoErrors.name) setPatientInfoErrors(p => ({ ...p, name: '' }));
                }}
                className={`w-full px-4 py-4 rounded-2xl border text-slate-800 placeholder-slate-300 text-base focus:outline-none focus:ring-2 focus:border-transparent transition bg-white ${
                  patientInfoErrors.name ? 'border-red-400 focus:ring-red-300' : 'border-slate-200 focus:ring-[#3D52D5]'
                }`}
              />
              {patientInfoErrors.name && (
                <p className="text-xs text-red-500 mt-1.5 ml-1">{patientInfoErrors.name}</p>
              )}
            </div>

            {/* 성별 */}
            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-800 mb-2">{curT.genderLabel}</label>
              <div className="flex gap-3">
                {[{ value: 'male', label: curT.male }, { value: 'female', label: curT.female }].map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPatientInfo(p => ({ ...p, gender: value }))}
                    className={`flex-1 py-4 rounded-2xl border-2 font-black text-base transition-all ${
                      patientInfo.gender === value
                        ? 'border-[#3D52D5] bg-[#EEF0FB] text-[#3D52D5]'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-[#3D52D5]/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 생년월일 */}
            {(() => {
              const today = new Date();
              const maxYear = today.getFullYear() - 18;
              const minYear = today.getFullYear() - 100;
              const { y: bdY, m: bdM, d: bdD } = bdParts;
              const daysInMonth = bdY && bdM ? new Date(parseInt(bdY), parseInt(bdM), 0).getDate() : 31;
              const hasError = !!patientInfoErrors.birthdate;

              const pickValue = (field, val) => {
                setBdParts(prev => {
                  const next = { ...prev, [field]: val };
                  // 일이 해당 월 최대일 초과하면 클램프
                  if (next.y && next.m) {
                    const maxD = new Date(parseInt(next.y), parseInt(next.m), 0).getDate();
                    if (next.d && parseInt(next.d) > maxD) next.d = String(maxD).padStart(2, '0');
                  }
                  // 셋 다 있으면 birthdate 동기화
                  const bd = next.y && next.m && next.d ? `${next.y}-${next.m}-${next.d}` : '';
                  setPatientInfo(p => ({ ...p, birthdate: bd }));
                  if (patientInfoErrors.birthdate) setPatientInfoErrors(p => ({ ...p, birthdate: '' }));
                  return next;
                });
              };

              const cell = (key, label, value, display, disabled) => (
                <button
                  type="button"
                  onClick={() => !disabled && setBdPicker(key)}
                  disabled={disabled}
                  className={`flex-1 flex flex-col items-center py-3.5 px-2 rounded-2xl border-2 transition-all ${
                    disabled ? 'bg-slate-50 border-slate-100 opacity-40 cursor-not-allowed'
                    : hasError ? 'bg-white border-red-300'
                    : value ? 'bg-[#EEF0FB] border-[#3D52D5]'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{label}</span>
                  <span className={`text-base font-black leading-none ${value ? 'text-[#3D52D5]' : 'text-slate-300'}`}>{display}</span>
                  <ChevronRight className={`w-3 h-3 rotate-90 mt-1.5 ${value ? 'text-[#3D52D5]' : 'text-slate-300'}`} />
                </button>
              );

              return (
                <div className="mb-5">
                  <label className="block text-sm font-bold text-slate-800 mb-2">{curT.birthdate}</label>
                  <div className="flex gap-2">
                    {cell('year',  curT.yearLabel,  bdY, bdY ? `${bdY}${curT.yearSuffix}`              : '----', false)}
                    {cell('month', curT.monthLabel, bdM, bdM ? `${parseInt(bdM)}${curT.monthSuffix}` : '--',   !bdY)}
                    {cell('day',   curT.dayLabel,   bdD, bdD ? `${parseInt(bdD)}${curT.daySuffix}`   : '--',   !bdY || !bdM)}
                  </div>
                  {hasError && <p className="text-xs text-red-500 mt-1.5 ml-1">{patientInfoErrors.birthdate}</p>}

                  {/* 피커 오버레이 */}
                  {bdPicker && (
                    <div className="fixed inset-0 z-[200] flex items-end" onClick={() => setBdPicker(null)}>
                      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                      <div className="relative w-full bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom-4 duration-200" onClick={e => e.stopPropagation()}>
                        {/* 헤더 */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
                          <span className="text-base font-black text-slate-900">
                            {bdPicker === 'year' ? curT.yearPlaceholder : bdPicker === 'month' ? curT.monthPlaceholder : curT.dayPlaceholder}
                          </span>
                          <button onClick={() => setBdPicker(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors">
                            <ArrowLeft className="w-4 h-4 text-slate-500 rotate-90" />
                          </button>
                        </div>
                        {/* 목록 */}
                        <div className="overflow-y-auto max-h-[45vh] py-2">
                          {bdPicker === 'year' && Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i).map(y => (
                            <button key={y} type="button" onClick={() => { pickValue('y', String(y)); setBdPicker(null); }}
                              className={`w-full px-6 py-3.5 text-left text-base font-bold transition-colors flex items-center justify-between ${bdY === String(y) ? 'text-[#3D52D5] bg-[#EEF0FB]' : 'text-slate-700 hover:bg-slate-50'}`}>
                              {y}{curT.yearSuffix}
                              {bdY === String(y) && <CheckCircle2 className="w-4 h-4 text-[#3D52D5]" />}
                            </button>
                          ))}
                          {bdPicker === 'month' && Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <button key={m} type="button" onClick={() => { pickValue('m', String(m).padStart(2,'0')); setBdPicker(null); }}
                              className={`w-full px-6 py-3.5 text-left text-base font-bold transition-colors flex items-center justify-between ${bdM === String(m).padStart(2,'0') ? 'text-[#3D52D5] bg-[#EEF0FB]' : 'text-slate-700 hover:bg-slate-50'}`}>
                              {m}{curT.monthSuffix}
                              {bdM === String(m).padStart(2,'0') && <CheckCircle2 className="w-4 h-4 text-[#3D52D5]" />}
                            </button>
                          ))}
                          {bdPicker === 'day' && Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                            <button key={d} type="button" onClick={() => { pickValue('d', String(d).padStart(2,'0')); setBdPicker(null); }}
                              className={`w-full px-6 py-3.5 text-left text-base font-bold transition-colors flex items-center justify-between ${bdD === String(d).padStart(2,'0') ? 'text-[#3D52D5] bg-[#EEF0FB]' : 'text-slate-700 hover:bg-slate-50'}`}>
                              {d}{curT.daySuffix}
                              {bdD === String(d).padStart(2,'0') && <CheckCircle2 className="w-4 h-4 text-[#3D52D5]" />}
                            </button>
                          ))}
                        </div>
                        <div className="h-safe-bottom pb-4" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 휴대폰 번호 */}
            <div className="mb-5">
              <label className="block text-sm font-bold text-slate-800 mb-2">
                {curT.phone}
              </label>
              <div className={`flex rounded-2xl border overflow-hidden transition bg-white ${
                patientInfoErrors.phone ? 'border-red-400' : 'border-slate-200'
              }`}>
                {/* 국가 코드 선택 */}
                {(() => {
                  const phoneCodes = [
                    { code: '+82', flag: '🇰🇷', label: '+82' },
                    { code: '+62', flag: '🇮🇩', label: '+62' },
                  ];
                  const selected = phoneCodes.find(c => c.code === patientInfo.phoneCode) || phoneCodes[0];
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => setShowPhoneCodePicker(true)}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-4 border-r border-slate-200 bg-slate-50 min-w-[80px]"
                      >
                        <span className="text-base">{selected.flag}</span>
                        <span className="text-sm font-bold text-slate-700">{selected.label}</span>
                        <ChevronRight className="w-3 h-3 text-slate-400 rotate-90" />
                      </button>
                      {showPhoneCodePicker && (
                        <div className="fixed inset-0 z-[200] flex items-end" onClick={() => setShowPhoneCodePicker(false)}>
                          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                          <div className="relative w-full bg-white rounded-t-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
                              <span className="text-base font-black text-slate-900">국가 코드 선택</span>
                              <button onClick={() => setShowPhoneCodePicker(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                                <ArrowLeft className="w-4 h-4 text-slate-500 rotate-90" />
                              </button>
                            </div>
                            <div className="overflow-y-auto max-h-[45vh] py-2">
                              {phoneCodes.map(c => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => { setPatientInfo(p => ({ ...p, phoneCode: c.code })); setShowPhoneCodePicker(false); }}
                                  className={`w-full px-6 py-3.5 text-left text-base font-bold transition-colors flex items-center justify-between ${patientInfo.phoneCode === c.code ? 'text-[#3D52D5] bg-[#EEF0FB]' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                  <span>{c.flag} {c.label}</span>
                                  {patientInfo.phoneCode === c.code && <CheckCircle2 className="w-4 h-4 text-[#3D52D5]" />}
                                </button>
                              ))}
                            </div>
                            <div className="h-4 pb-safe" />
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
                {/* 번호 입력 */}
                <input
                  type="tel"
                  placeholder={patientInfo.phoneCode === '+82' ? '010-1234-5678' : '0812-3456-7890'}
                  value={patientInfo.phone}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, '');
                    let formatted = digits;
                    if (patientInfo.phoneCode === '+82') {
                      // 010-1234-5678
                      if (digits.length <= 3) formatted = digits;
                      else if (digits.length <= 7) formatted = `${digits.slice(0,3)}-${digits.slice(3)}`;
                      else formatted = `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7,11)}`;
                    } else if (patientInfo.phoneCode === '+62') {
                      // 0812-3456-7890
                      if (digits.length <= 4) formatted = digits;
                      else if (digits.length <= 8) formatted = `${digits.slice(0,4)}-${digits.slice(4)}`;
                      else formatted = `${digits.slice(0,4)}-${digits.slice(4,8)}-${digits.slice(8,12)}`;
                    }
                    setPatientInfo(p => ({ ...p, phone: formatted }));
                    if (patientInfoErrors.phone) setPatientInfoErrors(p => ({ ...p, phone: '' }));
                  }}
                  className="flex-1 px-4 py-4 text-slate-800 placeholder-slate-300 text-base focus:outline-none bg-transparent"
                />
              </div>
              {patientInfoErrors.phone && (
                <p className="text-xs text-red-500 mt-1.5 ml-1">{patientInfoErrors.phone}</p>
              )}
            </div>

          </div>
        )}

        {/* ── 연구 참여 안내 ─────────────────────────────────── */}
        {view === 'study_guide' && (
          <div className="max-w-lg mx-auto animate-in fade-in duration-500 pb-28">

            {/* ── 히어로 ── */}
            <div className="pt-8 pb-10">
              <h1 className="text-[1.35rem] font-black text-slate-900 leading-[1.5] tracking-tight mb-4">
                {patientInfo.name
                  ? <>{patientInfo.name}{curT.guideHeroLine1}<br />{curT.guideHeroLine2}</>
                  : <>{curT.guideHeroLine2}</>}
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed">
                {curT.guideSubDesc}<br />{curT.guideTimeNote.replace('<b>','').replace('</b>','').replace(/약 |sekitar /, m => m).split(/(<b>.*?<\/b>)/).map((part, i) =>
                  part.startsWith('<b>') ? <strong key={i} className="text-slate-600">{part.replace(/<\/?b>/g,'')}</strong> : part
                )}
              </p>
            </div>

            {/* ── 동일 증상 안내 ── */}
            <div className="flex items-start gap-3 bg-[#FFF8E7] border border-[#F5C842] rounded-2xl px-4 py-3.5 mb-6">
              <span className="text-lg leading-none mt-0.5">⚠️</span>
              <p className="text-sm font-black text-[#7A5C00] leading-snug">{curT.guideSameSymptomNotice}</p>
            </div>

            {/* ── 구분선 ── */}
            <div className="h-px bg-slate-100 mb-8" />

            {/* ── 참여 단계 ── */}
            <div className="mb-8">
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-5">{curT.guideStepsTitle}</p>
              <div>
                {[
                  {
                    n: '01', label: curT.guideStep1Label, desc: curT.guideStep1Desc,
                    preview: (
                      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{curT.guidePreviewLabel}</p>
                        <div className="bg-slate-50 rounded-xl p-3 mb-2">
                          <p className="text-xs font-black text-slate-700 mb-2">{curT.guidePreviewQ1}</p>
                          {[curT.guidePreviewA1, curT.guidePreviewA2].map((opt, oi) => (
                            <div key={oi} className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-1 border text-xs font-bold ${oi === 0 ? 'border-[#3D52D5] bg-[#EEF0FB] text-[#3D52D5]' : 'border-slate-200 bg-white text-slate-500'}`}>
                              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${oi === 0 ? 'border-[#3D52D5]' : 'border-slate-300'}`}>
                                {oi === 0 && <div className="w-1.5 h-1.5 rounded-full bg-[#3D52D5]" />}
                              </div>
                              {opt}
                            </div>
                          ))}
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                          <p className="text-xs font-black text-slate-700 mb-2">{curT.guidePreviewQ2}</p>
                          <div className="flex gap-1 flex-wrap">
                            {curT.guidePreviewLoc.map((loc, li) => (
                              <span key={li} className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${li === 0 ? 'bg-[#3D52D5] text-white border-[#3D52D5]' : 'bg-white text-slate-500 border-slate-200'}`}>{loc}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  },
                  {
                    n: '02', label: curT.guideStep2Label, desc: curT.guideStep2Desc,
                    preview: (
                      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{curT.guidePreviewLabel}</p>
                        <div className="space-y-2">
                          <div className="flex gap-2 items-start">
                            <div className="w-6 h-6 rounded-full bg-[#3D52D5] flex items-center justify-center shrink-0">
                              <span className="text-white text-[8px] font-black">AI</span>
                            </div>
                            <div className="bg-slate-50 rounded-2xl rounded-tl-none px-3 py-2 max-w-[80%]">
                              <p className="text-xs text-slate-700 leading-relaxed">{curT.guidePreviewAiMsg1}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 items-start justify-end">
                            <div className="bg-[#3D52D5] rounded-2xl rounded-tr-none px-3 py-2 max-w-[80%]">
                              <p className="text-xs text-white leading-relaxed">{curT.guidePreviewUserMsg}</p>
                            </div>
                          </div>
                          <div className="flex gap-2 items-start">
                            <div className="w-6 h-6 rounded-full bg-[#3D52D5] flex items-center justify-center shrink-0">
                              <span className="text-white text-[8px] font-black">AI</span>
                            </div>
                            <div className="bg-slate-50 rounded-2xl rounded-tl-none px-3 py-2 max-w-[80%]">
                              <p className="text-xs text-slate-700 leading-relaxed">{curT.guidePreviewAiMsg2}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  },
                  {
                    n: '03', label: curT.guideStep3Label, desc: curT.guideStep3Desc,
                    preview: (
                      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{curT.guidePreviewLabel}</p>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-black text-slate-700 mb-2">{curT.guidePreviewSurveyQ}</p>
                            <div className="flex gap-1">
                              {[1,2,3,4,5].map(s => (
                                <div key={s} className={`flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-black ${s <= 4 ? 'bg-[#3D52D5] text-white' : 'bg-slate-100 text-slate-400'}`}>{s}</div>
                              ))}
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px] text-slate-400">{curT.guidePreviewScaleLow}</span>
                              <span className="text-[10px] text-slate-400">{curT.guidePreviewScaleHigh}</span>
                            </div>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-xs font-black text-slate-700 mb-1">{curT.guidePreviewOpinionTitle}</p>
                            <p className="text-[11px] text-slate-400">{curT.guidePreviewOpinionPlaceholder}</p>
                          </div>
                        </div>
                      </div>
                    )
                  },
                ].map(({ n, label, desc, preview }, i, arr) => (
                  <div key={n} className={`${i < arr.length - 1 ? 'border-b border-slate-100' : ''}`}>
                    <button
                      className="w-full flex gap-5 py-5 text-left"
                      onClick={() => setExpandedGuideStep(expandedGuideStep === i ? null : i)}
                    >
                      <span className="text-sm font-black text-slate-300 w-7 shrink-0 pt-0.5">{n}</span>
                      <div className="flex-1">
                        <p className="text-base font-black text-slate-900 mb-1">{label}</p>
                        <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
                      </div>
                      <div className={`w-7 h-7 rounded-full border border-slate-200 flex items-center justify-center shrink-0 transition-transform duration-200 ${expandedGuideStep === i ? 'rotate-180 bg-[#EEF0FB] border-[#3D52D5]' : ''}`}>
                        <ChevronRight className={`w-3.5 h-3.5 transition-colors ${expandedGuideStep === i ? 'text-[#3D52D5] rotate-90' : 'text-slate-300 rotate-90'}`} />
                      </div>
                    </button>
                    {expandedGuideStep === i && (
                      <div className="pb-5 animate-in fade-in slide-in-from-top-2 duration-200">
                        {preview}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ── 리워드 ── */}
            <div className="bg-[#F7F8FE] rounded-3xl p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{curT.guideRewardTitle}</p>
              </div>
              <p className="text-base text-slate-700 font-black leading-relaxed mb-1">{curT.guideRewardThanks}</p>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">{curT.guideRewardDesc}</p>
              <div className="space-y-2">
                {[curT.guideComplete1, curT.guideComplete2, curT.guideComplete3].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5">
                    <CheckCircle2 className="w-5 h-5 text-[#3D52D5] shrink-0" />
                    <span className="text-sm font-bold text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 안내 / 개인정보 ── */}
            <div className="flex gap-3">
              <div className="flex-1 border border-slate-100 rounded-2xl p-4">
                <AlertTriangle className="w-4 h-4 text-amber-400 mb-2" />
                <p className="text-[11px] font-black text-slate-700 mb-1">{curT.guideNoteTitle}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">{curT.guideNoteText}</p>
              </div>
              <div className="flex-1 border border-slate-100 rounded-2xl p-4">
                <Stethoscope className="w-4 h-4 text-slate-400 mb-2" />
                <p className="text-[11px] font-black text-slate-700 mb-1">{curT.guidePrivacyTitle}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">{curT.guidePrivacyText}</p>
              </div>
            </div>

          </div>
        )}

        {view === 'selection' && (
          <div className="max-w-lg mx-auto mt-6 animate-in fade-in slide-in-from-bottom-6 duration-500">
            {/* 타이틀 */}
            <div className="mb-7">
              <h2 className="text-2xl font-black text-slate-900 leading-tight">{curT.selectMethodTitle}</h2>
              <p className="text-slate-400 text-sm mt-2">{curT.selectMethodDesc}</p>
            </div>

            <div className="flex flex-col gap-4">
              {/* 룰 베이스 카드 */}
              <button
                onClick={() => { setView('rule_intro'); setActiveSurveyKey('rule'); setSurveyOrder(prev => prev.includes('rule') ? prev : [...prev, 'rule']); }}
                className="group relative rounded-3xl overflow-hidden text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.99] shadow-lg hover:shadow-xl"
              >
                {/* 그라데이션 배경 */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#3D52D5] via-[#2D3FB5] to-[#1E2D9E]" />
                {/* 패턴 오버레이 */}
                <div className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: 'radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }}
                />
                {/* SVG 일러스트 — 청진기 */}
                <div className="absolute right-0 bottom-0 w-36 h-36 opacity-20 translate-x-4 translate-y-4">
                  <svg viewBox="0 0 100 100" fill="white">
                    <circle cx="30" cy="30" r="18" fill="none" stroke="white" strokeWidth="6"/>
                    <path d="M48 30 Q70 30 70 52 L70 72" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round"/>
                    <circle cx="70" cy="76" r="8" fill="white"/>
                    <circle cx="70" cy="76" r="4" fill="none" stroke="white" strokeWidth="2" opacity="0.5"/>
                    <line x1="22" y1="30" x2="22" y2="48" stroke="white" strokeWidth="6" strokeLinecap="round"/>
                    <line x1="38" y1="30" x2="38" y2="48" stroke="white" strokeWidth="6" strokeLinecap="round"/>
                    <path d="M22 48 Q30 58 38 48" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="relative px-6 py-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30">
                      <Stethoscope className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white/70 text-xs font-bold uppercase tracking-widest">Rule-based</span>
                  </div>
                  <h3 className="text-xl font-black text-white mb-2">{curT.ruleMode}</h3>
                  <p className="text-white/75 text-sm leading-relaxed mb-5">{curT.ruleDesc}</p>
                  <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold text-sm px-4 py-2 rounded-xl group-hover:bg-white/30 transition-colors">
                    {curT.start} <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>

              {/* 채팅형 카드 */}
              <button
                onClick={() => { setView('chat_intro'); setActiveSurveyKey('chat'); setSurveyOrder(prev => prev.includes('chat') ? prev : [...prev, 'chat']); }}
                className="group relative rounded-3xl overflow-hidden text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.99] shadow-lg hover:shadow-xl"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#5B6FE0] via-[#4A5CD8] to-[#3D52D5]" />
                <div className="absolute inset-0 opacity-10"
                  style={{ backgroundImage: 'radial-gradient(circle at 80% 80%, white 1px, transparent 1px), radial-gradient(circle at 20% 20%, white 1px, transparent 1px)', backgroundSize: '28px 28px' }}
                />
                {/* SVG 일러스트 — 말풍선 */}
                <div className="absolute right-0 bottom-0 w-36 h-36 opacity-20 translate-x-4 translate-y-4">
                  <svg viewBox="0 0 100 100" fill="none">
                    <rect x="10" y="15" width="72" height="50" rx="14" fill="white"/>
                    <path d="M28 65 L20 82 L44 65" fill="white"/>
                    <circle cx="30" cy="40" r="5" fill="none" stroke="#7c3aed" strokeWidth="3"/>
                    <circle cx="46" cy="40" r="5" fill="none" stroke="#7c3aed" strokeWidth="3"/>
                    <circle cx="62" cy="40" r="5" fill="none" stroke="#7c3aed" strokeWidth="3"/>
                  </svg>
                </div>
                <div className="relative px-6 py-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-white/70 text-xs font-bold uppercase tracking-widest">AI Chat</span>
                  </div>
                  <h3 className="text-xl font-black text-white mb-2">{curT.chatMode}</h3>
                  <p className="text-white/75 text-sm leading-relaxed mb-5">{curT.chatDesc}</p>
                  <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm border border-white/30 text-white font-bold text-sm px-4 py-2 rounded-xl group-hover:bg-white/30 transition-colors">
                    {curT.start} <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {(view === 'rule_intro' || view === 'chat_intro') && (() => {
          const isRule = view === 'rule_intro';
          const bullets = isRule
            ? [curT.ruleIntroBullet1, curT.ruleIntroBullet2, curT.ruleIntroBullet3]
            : [curT.chatIntroBullet1, curT.chatIntroBullet2, curT.chatIntroBullet3];
          return (
            <div className="max-w-lg mx-auto animate-in fade-in duration-300 pb-32">
              <div className="pt-8 pb-2" />

              <h1 className="text-3xl font-black text-slate-900 leading-tight tracking-tight mb-4">
                {isRule ? curT.ruleIntroTitle : curT.chatIntroTitle}
              </h1>
              <p className="text-slate-500 text-base leading-relaxed mb-8">
                {isRule ? curT.ruleIntroDesc : curT.chatIntroDesc}
              </p>

              <div className="h-px bg-slate-100 mb-8" />

              <div className="flex flex-col gap-3">
                {bullets.map((b, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-2xl px-5 py-4">
                    <div className="w-8 h-8 rounded-xl bg-[#EEF0FB] flex items-center justify-center shrink-0">
                      <span className="text-xs font-black text-[#3D52D5]">{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-700">{b}</span>
                  </div>
                ))}
              </div>

            </div>
          );
        })()}

        {view === 'rule_categories' && (
          <div className="mt-8 animate-in fade-in zoom-in-95 max-w-4xl mx-auto pb-8">
            <div className="space-y-6">
              <h2 className="text-2xl font-black text-center tracking-tight">{curT.categories}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {categories.map(cat => (
                  <button key={cat.category_id} onClick={() => startRuleSurvey(cat)} className="bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm hover:border-[#3D52D5] hover:shadow-xl transition-all flex flex-col items-center gap-3 group overflow-hidden pb-4">
                    <div className="w-full h-32 bg-slate-50 rounded-t-[1.8rem] flex items-end justify-center pt-3 px-4 overflow-hidden">
                      {CATEGORY_IMAGES[cat.category_id] ? (
                        <img
                          src={CATEGORY_IMAGES[cat.category_id]}
                          alt={getLocalizedField(cat, 'category_name')}
                          className="h-full w-full object-contain object-bottom group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <Stethoscope className="w-10 h-10 text-slate-300 mb-4" />
                      )}
                    </div>
                    <span className="font-black text-slate-700 tracking-tight text-center text-sm px-3 group-hover:text-[#3D52D5] transition-colors">{getLocalizedField(cat, 'category_name')}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'rule_survey' && currentQuestion && (() => {
          const isBodyMap = currentQuestion.question_id === 'CAT001_Q01' || currentQuestion.question_id === 'CAT002_Q02';
          const isMultiple = responseTypeMap[currentQuestion.response_type_id] === true;
          const hint = isMultiple ? curT.multiSelectHint : curT.singleSelectHint;
          const isRedFlag = !!currentQuestion.is_red_flag;
          const questionNumber = !isRedFlag
            ? parseInt(currentQuestion.question_id.match(/_Q(\d+)/)?.[1] || '0', 10)
            : null;

          return isBodyMap ? (
            /* ── 통증 부위 선택 ── */
            <div className="mt-2 animate-in fade-in duration-300 pb-28">
              <div className="max-w-2xl mx-auto mb-3 pt-2 flex flex-col justify-start">
                <button
                  onClick={() => setView('rule_categories')}
                  className={`flex items-center justify-center w-9 h-9 rounded-full hover:bg-slate-100 transition-colors mb-1 -ml-1 ${questionHistory.length === 0 ? 'visible' : 'invisible'}`}
                >
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                {questionNumber && (
                  <p className="text-base font-black text-[#3D52D5] tracking-widest uppercase mb-1">Q{questionNumber}</p>
                )}
                <h2 className="text-2xl font-black text-slate-800 leading-tight">{getLocalizedField(currentQuestion, 'question_text')}</h2>
                <p className="text-sm text-slate-400 mt-1">{hint}</p>
              </div>
              <AbdomenBodyMap
                opts={optionsByQuestion[currentQuestion.question_id] || []}
                selectedOptions={selectedOptions}
                onSelect={handleOptionSelect}
              />
            </div>
          ) : (
            /* ── 일반 질문 (새 레이아웃) ── */
            <div className="max-w-lg mx-auto mt-2 animate-in fade-in duration-300 pb-32">
              {/* 질문 제목 — 뒤로가기 버튼 공간 항상 유지 */}
              <div className="mb-6 pt-2 flex flex-col justify-start">
                <button
                  onClick={() => setView('rule_categories')}
                  className={`flex items-center justify-center w-9 h-9 rounded-full hover:bg-slate-100 transition-colors mb-1 -ml-1 ${questionHistory.length === 0 ? 'visible' : 'invisible'}`}
                >
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                {questionNumber && (
                  <p className="text-base font-black text-[#3D52D5] tracking-widest uppercase mb-1">Q{questionNumber}</p>
                )}
                <h2 className="text-2xl font-black text-slate-800 leading-tight">
                  {getLocalizedField(currentQuestion, 'question_text')}
                </h2>
                <p className="text-sm text-slate-400 mt-3">{hint}</p>
              </div>

              {/* 옵션 목록 */}
              <div className="flex flex-col gap-3">
                {(optionsByQuestion[currentQuestion.question_id] || [])
                  .sort((a, b) => a.display_order - b.display_order)
                  .map(opt => {
                    const isSelected = selectedOptions.includes(opt.option_id);
                    return (
                      <button
                        key={opt.option_id}
                        onClick={() => handleOptionSelect(opt)}
                        className={`w-full px-5 py-4 rounded-2xl border-2 flex items-center justify-between text-left transition-all active:scale-[0.99] ${
                          isSelected
                            ? 'border-[#3D52D5] bg-[#EEF0FB]'
                            : 'border-slate-200 bg-white hover:border-[#3D52D5]/60'
                        }`}
                      >
                        <span className={`font-bold text-base ${isSelected ? 'text-[#3D52D5]' : 'text-slate-600'}`}>
                          {getLocalizedField(opt, 'option_text')}
                        </span>
                        {isMultiple ? (
                          /* 체크박스 */
                          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'border-[#3D52D5] bg-[#3D52D5]' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && (
                              <svg viewBox="0 0 12 10" fill="none" className="w-3.5 h-3.5">
                                <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                        ) : (
                          /* 라디오 */
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'border-[#3D52D5]' : 'border-slate-300'
                          }`}>
                            {isSelected && <div className="w-3.5 h-3.5 rounded-full bg-[#3D52D5]" />}
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>

            </div>
          );
        })()}

        {view === 'red_flag_alert' && (
          <div className="max-w-2xl mx-auto mt-12 p-12 bg-white rounded-[3rem] shadow-2xl border-4 border-red-500 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-8">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto border-4 border-red-200 animate-pulse">
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-4xl font-black text-red-600">{curT.redFlagWarning}</h2>
              <div className="bg-red-50/50 p-8 rounded-3xl border-2 border-red-200">
                <p className="text-slate-700 text-lg leading-relaxed">
                  {curT.redFlagMessage}
                </p>
              </div>
              <button
                onClick={checkUserInfoAndFinish}
                className="inline-flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:shadow-xl transition-all"
              >
                {curT.goToResults}
              </button>
            </div>
          </div>
        )}

        {view === 'chat_survey' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 flex flex-col" style={{ height: 'calc(100dvh - 4rem)' }}>

            {/* 채팅 헤더 */}
            <div className="max-w-3xl mx-auto w-full px-4 flex items-center gap-3 py-3 shrink-0">
              {!routeMode && (
                <button
                  onClick={() => {
                    setView('selection');
                    setChatMessages([]);
                    chatMessageCountRef.current = 0;
                    setChatDisabled(false);
                    setActiveSurveyKey(null);
                    setSurveyOrder(prev => completedSurveyKeys.includes('chat') ? prev : prev.filter(s => s !== 'chat'));
                  }}
                  className="flex items-center gap-1.5 text-slate-400 font-bold hover:text-slate-900 transition-colors group shrink-0"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                  {curT.backToMethods}
                </button>
              )}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl overflow-hidden shadow-md shrink-0">
                  <img src={meninbloxIcon} alt="MENINBLOX" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-900 leading-none">{curT.aiAssistant}</p>
                  <p className="text-[9px] text-[#3D52D5] font-bold flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-[#3D52D5] animate-pulse" /> Online
                  </p>
                </div>
              </div>
              <div className="flex-1" />
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-[#FAFBFF] px-4 py-4 space-y-6 max-w-3xl mx-auto w-full">
              {chatMessages.map((m, i) => (
                <div key={i} className={`flex items-end gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'} animate-in slide-in-from-bottom-2 duration-300`}>
                  {m.role === 'ai' && (
                    <div className="w-8 h-8 rounded-xl overflow-hidden shadow-sm shrink-0 mb-1 relative">
                      <img src={meninbloxIcon} alt="MENINBLOX" className="w-full h-full object-cover" />
                      {m.streaming && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                          <Loader2 className="w-4 h-4 animate-spin text-[#3D52D5]" />
                        </div>
                      )}
                    </div>
                  )}
                  <div className={`flex flex-col gap-1 ${m.isMarkdown ? 'max-w-[90%]' : 'max-w-[75%]'} ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`px-5 py-4 text-sm leading-relaxed shadow-sm ${m.role === 'user'
                      ? 'bg-slate-900 text-white rounded-[1.5rem] rounded-br-none shadow-slate-200'
                      : 'bg-white text-slate-800 rounded-[1.5rem] rounded-bl-none border border-slate-100'
                      }`}>
                      {m.isMarkdown ? (
                        <div className="markdown-chat space-y-3">
                          {m.content.split('\n').map((line, idx) => {
                            if (line.match(/^##\s/)) {
                              const text = line.replace(/^##\s*/, '');
                              return <h3 key={idx} className="text-base font-bold text-[#3D52D5] mt-3 mb-2">{text}</h3>;
                            }
                            if (line.match(/^[\s]*[-*]\s/)) {
                              const text = line.replace(/^[\s]*[-*]\s*/, '');
                              const processed = text
                                .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
                              return <div key={idx} className="flex gap-2 ml-3"><span className="text-[#3D52D5]">•</span><span dangerouslySetInnerHTML={{ __html: processed }} /></div>;
                            }
                            if (line.trim()) {
                              const processed = line
                                .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
                                .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
                              return <p key={idx} className="text-slate-700" dangerouslySetInnerHTML={{ __html: processed }} />;
                            }
                            return null;
                          })}
                        </div>
                      ) : (
                        <>
                          {m.content || (m.streaming ? '...' : '')}
                          {m.streaming && <span className="inline-block w-1 h-4 bg-[#3D52D5] ml-1 animate-pulse" />}
                        </>
                      )}
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 mx-1">{m.time}</span>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* 입력창 — 하단 고정 */}
            <div className="shrink-0 bg-white border-t border-slate-100 px-4 pt-3 pb-5">
              <div className="max-w-3xl mx-auto flex items-center gap-3">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !isProcessing && !chatDisabled && handleChatSend()}
                  placeholder={chatDisabled ? curT.chatEnded : isProcessing ? curT.aiTyping : curT.typeMessage}
                  disabled={isProcessing || chatDisabled}
                  className="flex-1 bg-slate-50 border-2 border-transparent focus:border-[#3D52D5] focus:bg-white rounded-2xl px-5 py-4 text-sm outline-none font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleChatSend}
                  disabled={!input.trim() || isProcessing || chatDisabled}
                  className={`p-4 rounded-xl transition-all shadow-lg ${input.trim() && !isProcessing && !chatDisabled ? 'bg-[#3D52D5] text-white shadow-[#3D52D5]/20 scale-100' : 'bg-slate-100 text-slate-300 scale-95'} disabled:cursor-not-allowed`}
                >
                  {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-[9px] text-center text-slate-300 mt-2 font-bold tracking-widest uppercase">Conversation is secure and stored for verification purposes</p>
            </div>
          </div>
        )}

        {view === 'results' && (() => {
          const parsed = (() => {
            if (!aiAnalysis) return null;
            if (typeof aiAnalysis === 'object') return aiAnalysis;
            try { return JSON.parse(aiAnalysis); } catch { return null; }
          })();
          const resultList = parsed?.result || [];
          const symptomSummary = parsed?.symptom_summary || '';

          return (
            <div className="max-w-lg mx-auto mt-4 animate-in fade-in duration-300 pb-44">

              {/* 환자 정보 헤더 */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-baseline gap-2">
                    <h2 className="text-2xl font-black text-slate-900">{curT.resultsTitle}</h2>
                    <span className="text-xs text-slate-400">{new Date().toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'id-ID')}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap justify-end items-center">
                  <span className="px-2.5 py-1 bg-[#EEF0FB] text-[#3D52D5] text-xs font-black rounded-full">
                    {patientInfo.gender === 'male' ? curT.male : patientInfo.gender === 'female' ? curT.female : userData.gender === 'male' ? curT.male : curT.female}
                  </span>
                  {(patientInfo.birthdate || userData.age) && (
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-black rounded-full">
                      {patientInfo.birthdate
                        ? `${new Date().getFullYear() - new Date(patientInfo.birthdate).getFullYear()}${curT.ageSuffix}`
                        : `${userData.age}${curT.ageSuffix}`}
                    </span>
                  )}
                  {redFlagTriggered && (
                    <span className="px-2.5 py-1 bg-red-100 text-red-600 text-xs font-black rounded-full">⚠ Red Flag</span>
                  )}
                </div>
              </div>

              {isProcessing ? (
                /* 로딩 */
                <div className="bg-white rounded-3xl border border-slate-100 p-10 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-10 h-10 text-[#3D52D5] animate-spin" />
                  <p className="font-black text-slate-700">{curT.analyzingResult}</p>
                  <p className="text-xs text-slate-400">{curT.analyzingSymptoms}</p>
                </div>
              ) : parsed ? (
                <>
                  {/* 감별 진단 — 드롭다운 카드 */}
                  {resultList.length > 0 && (
                    <div className="space-y-2 mt-8">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">{curT.diffDiagnosisLabel} ({resultList.length})</p>
                      {resultList.map((item, idx) => (
                        <details key={idx} className="group bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden" open={idx === 0}>
                          {/* 드롭다운 헤더: 번호 + 질환명 */}
                          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${idx === 0 ? 'bg-[#3D52D5] text-white' : 'bg-slate-200 text-slate-500'}`}>{idx + 1}</span>
                              <span className="font-black text-slate-900 text-sm leading-snug">
                                {Array.isArray(item.disease) ? item.disease.join(', ') : item.disease}
                              </span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-open:rotate-90 transition-transform" />
                          </summary>

                          {/* 드롭다운 내용 */}
                          <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">

                            {/* 증상 요약 */}
                            {symptomSummary && (
                              <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{curT.symptomSummaryLabel}</p>
                                <p className="text-sm text-slate-600 leading-relaxed">{symptomSummary}</p>
                              </div>
                            )}

                            {/* 위험 신호 */}
                            {item.red_flags?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">{curT.redFlagsLabel}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {item.red_flags.map((f, i) => (
                                    <span key={i} className="px-2.5 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-full border border-red-100">{f}</span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 근거 (지지 근거만, 반대 근거 제외) */}
                            {item.differential_reasoning?.supporting?.length > 0 && (
                              <div className="bg-slate-50 rounded-2xl p-4">
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{curT.evidenceLabel}</p>
                                <ul className="space-y-1.5">
                                  {item.differential_reasoning.supporting.map((s, i) => (
                                    <li key={i} className="text-xs text-slate-700 leading-relaxed flex gap-2"><span className="mt-1 shrink-0 text-[#3D52D5]">·</span>{s}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* 환자 안내 */}
                            {item.patient_edu?.length > 0 && (
                              <div className="bg-[#EEF0FB] rounded-2xl p-4">
                                <p className="text-[10px] font-black text-[#3D52D5] uppercase tracking-widest mb-2">{curT.patientEduLabel}</p>
                                <ul className="space-y-1.5">
                                  {item.patient_edu.map((e, i) => (
                                    <li key={i} className="text-xs text-[#1E2D9E] leading-relaxed flex gap-2"><span className="mt-1 shrink-0">·</span>{e}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </details>
                      ))}
                    </div>
                  )}

                </>
              ) : (
                <div className="bg-white rounded-3xl border border-slate-100 p-6">
                  <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{typeof aiAnalysis === 'string' ? aiAnalysis : curT.noResultText}</p>
                </div>
              )}

              {/* 답변 내역 — 독립 섹션 */}
              {historyData.length > 0 && (
                <div className="mt-6">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{curT.myAnswersLabel}</p>
                  <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                    <div className="divide-y divide-slate-50">
                      {historyData.map((h, i) => (
                        <div key={i} className="px-5 py-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{h.q}</p>
                          <p className="text-sm font-bold text-slate-800">{h.a}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </div>
          );
        })()}
      </main>

      {/* ── 하단 고정 바 ── */}
      {['consent','user_confirm_written','study_guide','rule_intro','chat_intro','rule_survey','results'].includes(view) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-100 px-6 pt-3 pb-5">

          {/* 동의서 */}
          {view === 'consent' && (
            <div className="max-w-lg mx-auto space-y-3">
              <button
                onClick={() => setConsentChecked(v => !v)}
                className={`flex items-center gap-3 w-full text-left px-4 py-3.5 rounded-2xl border-2 transition-all ${
                  consentChecked ? 'border-[#3D52D5] bg-[#EEF0FB]' : 'border-slate-200 bg-white'
                }`}
              >
                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                  consentChecked ? 'bg-[#3D52D5] border-[#3D52D5]' : 'border-slate-300 bg-white'
                }`}>
                  {consentChecked && (
                    <svg viewBox="0 0 12 10" fill="none" className="w-3.5 h-3.5">
                      <path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className={`text-sm font-bold leading-snug ${consentChecked ? 'text-[#3D52D5]' : 'text-slate-500'}`}>
                  {curT.consentCheckbox}
                </span>
              </button>
              <button
                onClick={() => { if (consentChecked) setView('user_confirm_written'); }}
                disabled={!consentChecked}
                className={`w-full py-4 rounded-2xl font-black text-base transition-all ${
                  consentChecked
                    ? 'bg-[#3D52D5] text-white shadow-lg shadow-[#3D52D5]/20 hover:bg-[#2D3FB5] active:scale-[0.98]'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                }`}
              >
                {curT.consentButton}
              </button>
            </div>
          )}

          {/* 개인정보 입력 */}
          {view === 'user_confirm_written' && (
            <div className="max-w-lg mx-auto">
              <button
                onClick={() => {
                  const errors = { name: '', birthdate: '', phone: '' };
                  let valid = true;
                  if (!patientInfo.name.trim()) {
                    errors.name = curT.errNameRequired;
                    valid = false;
                  } else if (patientInfo.name.trim().length > 100) {
                    errors.name = curT.errNameTooLong;
                    valid = false;
                  }
                  if (!patientInfo.birthdate) {
                    errors.birthdate = curT.errBirthdateRequired;
                    valid = false;
                  } else {
                    const today = new Date();
                    const birth = new Date(patientInfo.birthdate);
                    const age = today.getFullYear() - birth.getFullYear() - (
                      today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0
                    );
                    if (age < 18 || age > 100) {
                      errors.birthdate = curT.errBirthdateAge;
                      valid = false;
                    }
                  }
                  const digitsOnly = patientInfo.phone.replace(/\D/g, '');
                  if (!patientInfo.phone.trim()) {
                    errors.phone = curT.errPhoneRequired;
                    valid = false;
                  } else if (digitsOnly.length < 8) {
                    errors.phone = curT.errPhoneInvalid;
                    valid = false;
                  }
                  setPatientInfoErrors(errors);
                  if (valid) setView('study_guide');
                }}
                disabled={!patientInfo.name.trim() || !patientInfo.gender || !patientInfo.birthdate || !patientInfo.phone.trim()}
                className={`w-full py-4 rounded-2xl font-black text-base transition-all ${
                  !patientInfo.name.trim() || !patientInfo.gender || !patientInfo.birthdate || !patientInfo.phone.trim()
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#3D52D5] text-white shadow-lg shadow-[#3D52D5]/20 hover:bg-[#2D3FB5] active:scale-[0.98]'
                }`}
              >
                {curT.next}
              </button>
            </div>
          )}

          {/* 참여 안내 */}
          {view === 'study_guide' && (
            <div className="max-w-lg mx-auto">
              <button
                onClick={async () => {
                  if (routeMode) {
                    const firstKey = await assignFirstSurvey();
                    setSurveyOrder([firstKey]);
                    setActiveSurveyKey(firstKey);
                    if (firstKey === 'chat') {
                      setView('chat_intro');
                    } else {
                      setView('rule_intro');
                    }
                  } else {
                    setView('selection');
                  }
                }}
                className="w-full py-4 rounded-2xl font-black text-base bg-[#3D52D5] text-white shadow-lg shadow-[#3D52D5]/20 hover:bg-[#2D3FB5] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {curT.guideParticipateBtn}
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
          )}

          {/* 문진 안내 (rule_intro / chat_intro) */}
          {(view === 'rule_intro' || view === 'chat_intro') && (
            <div className="max-w-lg mx-auto">
              <button
                onClick={() => {
                  if (view === 'rule_intro') {
                    setView('rule_categories');
                  } else {
                    setChatMessages([]);
                    setChatDisabled(false);
                    setView('chat_survey');
                  }
                }}
                className="w-full py-4 rounded-2xl font-black text-base bg-[#3D52D5] text-white shadow-lg shadow-[#3D52D5]/20 hover:bg-[#2D3FB5] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {curT.introStartBtn} <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
          )}

          {/* 선택형 문진 */}
          {view === 'rule_survey' && currentQuestion && (
            <div className="max-w-lg mx-auto flex gap-3">
              <button
                onClick={handlePreviousQuestion}
                disabled={questionHistory.length === 0}
                className="flex-1 py-4 rounded-2xl font-black text-base border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {curT.back}
              </button>
              <button
                onClick={handleNextQuestion}
                disabled={selectedOptions.length === 0}
                className="flex-[2] py-4 rounded-2xl font-black text-base bg-[#3D52D5] text-white hover:bg-[#2D3FB5] transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {curT.next}
              </button>
            </div>
          )}

          {/* 결과 */}
          {view === 'results' && (() => {
            const bothDone = completedSurveyKeys.includes('rule') && completedSurveyKeys.includes('chat');
            return (
              <div className="max-w-lg mx-auto space-y-3">
                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-[10px] text-slate-400 leading-relaxed text-center">{curT.disclaimer}</p>
                </div>
                {bothDone ? (
                  <a
                    href="https://forms.gle/PK5ZKZeZsh9UmQuR8"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 ${isProcessing ? 'bg-slate-200 text-slate-400 pointer-events-none' : 'bg-[#3D52D5] text-white shadow-lg shadow-[#3D52D5]/20 hover:bg-[#2D3FB5] active:scale-[0.98]'}`}
                  >
                    {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> {curT.analyzingBtn}</> : <>{curT.surveyParticipateBtn} <ArrowLeft className="w-4 h-4 rotate-180" /></>}
                  </a>
                ) : (
                  <button
                    disabled={isProcessing}
                    onClick={() => {
                      const nextKey = surveyOrder[0] === 'rule' ? 'chat' : 'rule';
                      setHistoryData([]);
                      setAnswers({});
                      setAiAnalysis(null);
                      setSelectedCategory(null);
                      setRedFlagTriggered(false);
                      chatMessageCountRef.current = 0;
                      if (nextKey === 'chat') {
                        setChatMessages([]);
                        setChatDisabled(false);
                        setActiveSurveyKey('chat');
                        setSurveyOrder(prev => prev.includes('chat') ? prev : [...prev, 'chat']);
                        setView('chat_intro');
                      } else {
                        setActiveSurveyKey('rule');
                        setSurveyOrder(prev => prev.includes('rule') ? prev : [...prev, 'rule']);
                        setView('rule_intro');
                      }
                    }}
                    className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-2 ${isProcessing ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-[#3D52D5] active:scale-[0.98]'}`}
                  >
                    {isProcessing
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> {curT.analyzingBtn}</>
                      : <>{surveyOrder[0] === 'rule' ? curT.nextChatBtn : curT.nextRuleBtn} <ArrowLeft className="w-4 h-4 rotate-180" /></>
                    }
                  </button>
                )}
              </div>
            );
          })()}

        </div>
      )}

      {/* 설문조사 이동 팝업 */}
      {showNextStepPopup && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNextStepPopup(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            {/* 상단 배너 */}
            <div className="bg-[#3D52D5] px-6 pt-6 pb-8 text-white relative overflow-hidden">
              <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
              <div className="relative">
                <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-black leading-snug">문진이 모두 완료되었습니다!</h3>
                <p className="text-sm text-white/75 mt-1">마지막으로 설문조사에 참여해주세요.</p>
              </div>
            </div>
            {/* 완료 뱃지 */}
            <div className="px-6 -mt-4">
              <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-4 flex gap-3">
                {[{ label: '선택형 문진', key: 'rule' }, { label: '채팅 문진', key: 'chat' }].map(({ label, key }) => (
                  <div key={key} className="flex-1 flex items-center gap-2 bg-[#EEF0FB] rounded-xl px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 text-[#3D52D5] shrink-0" />
                    <span className="text-xs font-black text-[#3D52D5]">{label}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* 버튼 */}
            <div className="px-6 py-5 space-y-2">
              <a
                href="https://forms.gle/PK5ZKZeZsh9UmQuR8"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowNextStepPopup(false)}
                className="w-full py-4 bg-[#3D52D5] text-white rounded-2xl font-black text-base shadow-lg shadow-[#3D52D5]/20 hover:bg-[#2D3FB5] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                설문조사 하기
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </a>
              <button
                onClick={() => setShowNextStepPopup(false)}
                className="w-full py-3 text-slate-400 font-bold text-sm hover:text-slate-700 transition-colors"
              >
                나중에 하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="bg-white w-full max-w-xl rounded-[3.5rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.3)] p-12 overflow-hidden relative border border-slate-100">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-50">
              <div className="h-full bg-[#3D52D5] w-full"></div>
            </div>
            <LanguageSelectionStep />
            <div className="mt-8 text-center">
              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Protocol V2.5 Verification Session</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
        
        .analysis-content {
          line-height: 1.9;
          font-size: 1.05rem;
        }
        
        .analysis-content h2 {
          font-weight: 900;
          margin-top: 2rem;
          margin-bottom: 1.5rem;
          font-size: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.3s ease;
        }
        
        .analysis-content h3 {
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 1rem;
          font-size: 1.1rem;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .analysis-content ul {
          margin-left: 0;
          margin-top: 1rem;
          margin-bottom: 1.5rem;
          list-style-type: none;
          padding-left: 0;
        }
        
        .analysis-content ol {
          margin-left: 0;
          margin-top: 1rem;
          margin-bottom: 1.5rem;
          list-style-type: none;
          counter-reset: item;
          padding-left: 0;
        }
        
        .analysis-content ul li {
          margin-bottom: 1rem;
          padding-left: 2rem;
          color: #475569;
          line-height: 1.8;
          position: relative;
        }
        
        .analysis-content ul li::before {
          content: "●";
          position: absolute;
          left: 0.5rem;
          color: #3b82f6;
          font-size: 1.2rem;
          font-weight: bold;
        }
        
        .analysis-content ol li {
          margin-bottom: 1rem;
          padding-left: 2.5rem;
          color: #475569;
          line-height: 1.8;
          position: relative;
          counter-increment: item;
        }
        
        .analysis-content ol li::before {
          content: counter(item);
          position: absolute;
          left: 0.5rem;
          width: 1.5rem;
          height: 1.5rem;
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 0.75rem;
        }
        
        .analysis-content p {
          margin-bottom: 1rem;
          color: #334155;
        }
      `}</style>
    </div>
  );
};

export default App;