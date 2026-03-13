/**
 * Google Apps Script — MediKoGPT 문진 데이터 수집
 *
 * [설정 방법]
 * 1. https://sheets.google.com 에서 새 스프레드시트 생성
 * 2. 상단 메뉴 → 확장 프로그램 → Apps Script
 * 3. 이 파일 내용을 붙여넣기
 * 4. SHEET_NAME을 원하는 시트명으로 변경 (기본: "responses")
 * 5. 저장 후 상단 "배포" → "새 배포" 클릭
 *    - 유형: 웹 앱
 *    - 실행 계정: 나(본인)
 *    - 액세스 권한: 모든 사용자
 * 6. 배포 후 발급된 URL을 복사
 * 7. backend/.env 에 추가: GOOGLE_SHEET_URL=<복사한 URL>
 */

const SHEET_NAME = 'responses';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 시트 없으면 생성
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      // 헤더 행 추가
      sheet.appendRow([
        'Timestamp',
        'Session ID',
        'Language',
        'Name',
        'Gender',
        'Birthdate',
        'Phone',
        'Survey Type',
        'Category',
        'Red Flag Triggered',
        'Symptom Summary',
        'Diagnosis 1',
        'Confidence 1',
        'Diagnosis 2',
        'Confidence 2',
        'Diagnosis 3',
        'Confidence 3',
        'Questionnaire Responses (JSON)',
        'Chat History (JSON)',
      ]);
      // 헤더 스타일
      sheet.getRange(1, 1, 1, 19).setFontWeight('bold').setBackground('#3D52D5').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    const analysis = data.analysis || {};
    const results = analysis.result || [];

    const row = [
      new Date().toISOString(),
      data.sessionId || '',
      data.language || '',
      data.name || '',
      data.gender || '',
      data.birthdate || '',
      data.phone || '',
      data.surveyType || '',
      data.category || '',
      data.redFlagTriggered ? 'YES' : 'NO',
      analysis.symptom_summary || '',
      results[0] ? (results[0].disease || []).join(', ') : '',
      results[0] ? results[0].confidence || '' : '',
      results[1] ? (results[1].disease || []).join(', ') : '',
      results[1] ? results[1].confidence || '' : '',
      results[2] ? (results[2].disease || []).join(', ') : '',
      results[2] ? results[2].confidence || '' : '',
      JSON.stringify(data.responses || []),
      JSON.stringify(data.chatHistory || []),
    ];

    sheet.appendRow(row);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 테스트용 (Apps Script 에디터에서 직접 실행)
function testPost() {
  const mockData = {
    postData: {
      contents: JSON.stringify({
        sessionId: 'test-001',
        language: 'ko',
        name: '홍길동',
        gender: 'male',
        birthdate: '1990-01-01',
        phone: '010-1234-5678',
        surveyType: 'rule',
        category: '배가 아파요',
        redFlagTriggered: false,
        analysis: {
          symptom_summary: '상복부 통증',
          result: [
            { disease: ['위식도 역류질환'], confidence: 'high' },
            { disease: ['기능성 소화불량'], confidence: 'medium' },
            { disease: ['위염'], confidence: 'low' },
          ],
        },
        responses: [{ question: 'Q1', answers: ['A1'] }],
        chatHistory: [
          { role: 'user', content: '배가 아파요' },
          { role: 'ai', content: '언제부터 아프셨나요?' },
        ],
      }),
    },
  };
  Logger.log(doPost(mockData).getContent());
}
