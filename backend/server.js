const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// YAML 프롬프트 로드
let prompts;
try {
    const promptsPath = path.join(__dirname, 'prompts.yaml');
    const fileContents = fs.readFileSync(promptsPath, 'utf8');
    prompts = yaml.load(fileContents);
    console.log('✅ Prompts YAML loaded successfully');
} catch (error) {
    console.error('❌ Failed to load prompts.yaml:', error.message);
    process.exit(1);
}

// OpenAI 클라이언트 초기화 (채팅용)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// AI 서버 URL (선택형 문진 분석용 — inference_server.py)
const AI_SERVER_URL = process.env.GPU_SERVER_URL || 'http://121.167.147.14:8755';

// Google Sheets 저장 함수
async function saveToGoogleSheets(payload) {
    const url = process.env.GOOGLE_SHEET_URL;
    if (!url) {
        console.log('⚠️  GOOGLE_SHEET_URL not set, skipping sheets save.');
        return;
    }
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            redirect: 'follow',
        });
        const json = await res.json();
        if (json.success) {
            console.log('✅ Saved to Google Sheets');
        } else {
            console.error('❌ Google Sheets error:', json.error);
        }
    } catch (err) {
        console.error('❌ Failed to save to Google Sheets:', err.message);
    }
}

if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY is not set in environment variables.');
    process.exit(1);
}

// 미들웨어
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.' }
});
app.use('/api/', limiter);

// 헬스체크
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'medical-questionnaire-backend',
        openai: process.env.OPENAI_API_KEY ? 'configured' : 'not configured'
    });
});

// 문진 순서 배정 카운터 (파일 영구 저장)
const COUNTER_FILE = path.join(__dirname, 'survey_counters.json');

function loadCounters() {
    try {
        return JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function saveCounters(counters) {
    fs.writeFileSync(COUNTER_FILE, JSON.stringify(counters, null, 2));
}

const surveyCounters = loadCounters();

app.get('/api/assign-survey', (req, res) => {
    const mode = req.query.mode || 'default';
    surveyCounters[mode] = (surveyCounters[mode] || 0) + 1;
    saveCounters(surveyCounters);
    const first = surveyCounters[mode] % 2 === 1 ? 'rule' : 'chat';
    console.log(`[assign-survey] mode=${mode} count=${surveyCounters[mode]} → ${first}`);
    res.json({ firstSurvey: first, count: surveyCounters[mode] });
});

// 언어 코드 매핑
const languageMap = {
    'ko': 'Korean (한국어)',
    'vn': 'Vietnamese (Tiếng Việt)',
    'vi': 'Vietnamese (Tiếng Việt)',
    'id': 'Indonesian (Bahasa Indonesia)'
};

// AI 채팅 엔드포인트 (스트리밍)
app.post('/api/chat', async (req, res) => {
    try {
        const { message, history = [], language = 'ko', gender = 'unknown', age = 'unknown', sessionId } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: '메시지가 필요합니다.' });
        }

        if (message.length > 2000) {
            return res.status(400).json({ error: '메시지가 너무 깁니다. (최대 2000자)' });
        }

        const languageName = languageMap[language] || 'Korean (한국어)';

        // 언어에 맞는 질병 리스트 선택
        let diseaseList = '';
        let headerSuspectedDisease = '';
        let headerReason = '';
        let headerPatientEducation = '';

        if (language === 'ko') {
            diseaseList = prompts.diseases.korean.map(d => `- ${d}`).join('\n');
            headerSuspectedDisease = '의심되는 질환';
            headerReason = '이유';
            headerPatientEducation = '환자 교육';
        } else if (language === 'vn' || language === 'vi') {
            diseaseList = prompts.diseases.vietnamese.map(d => `- ${d}`).join('\n');
            headerSuspectedDisease = 'Bệnh nghi ngờ';
            headerReason = 'Lý do';
            headerPatientEducation = 'Giáo dục bệnh nhân';
        } else if (language === 'id') {
            diseaseList = prompts.diseases.indonesian.map(d => `- ${d}`).join('\n');
            headerSuspectedDisease = 'Penyakit yang Dicurigai';
            headerReason = 'Alasan';
            headerPatientEducation = 'Edukasi Pasien';
        } else {
            diseaseList = prompts.diseases.korean.map(d => `- ${d}`).join('\n');
            headerSuspectedDisease = '의심되는 질환';
            headerReason = '이유';
            headerPatientEducation = '환자 교육';
        }

        const systemPrompt = prompts.chat_prompt
            .replace('{language}', languageName)
            .replace('{gender}', gender)
            .replace('{age}', age)
            .replace('{disease_list}', diseaseList)
            .replace('{header_suspected_disease}', headerSuspectedDisease)
            .replace('{header_reason}', headerReason)
            .replace('{header_patient_education}', headerPatientEducation);

        console.log(`[${new Date().toISOString()}] Chat Stream - Language: ${language}, Gender: ${gender}, Age: ${age}`);
        console.log(`[${new Date().toISOString()}] History length: ${history.length}, Current message: ${message.substring(0, 100)}...`);
        console.log(`[${new Date().toISOString()}] Disease List Count: ${diseaseList.split('\n').length}`);

        // 메시지 배열 구성: system prompt + 히스토리 + 현재 메시지
        const messages = [
            { role: 'system', content: systemPrompt },
            ...history,  // 전체 대화 히스토리 포함
            { role: 'user', content: message }
        ];

        console.log(`[${new Date().toISOString()}] Total messages sent to OpenAI: ${messages.length}`);

        // SSE 헤더 설정
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const stream = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: messages,
            max_tokens: 2000,
            temperature: 0.7,
            stream: true,
        });

        let fullResponse = '';

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullResponse += content;
                // SSE 형식으로 데이터 전송
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }

        // 스트림 종료 신호
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        console.log(`[${new Date().toISOString()}] Chat stream completed - Length: ${fullResponse.length}`);
        res.end();

    } catch (error) {
        console.error('AI Chat Error:', error);
        console.error('Error details:', error.message, error.status, error.code);

        // 에러 응답
        if (!res.headersSent) {
            if (error.status === 429) {
                return res.status(429).json({ error: 'API 사용량이 초과되었습니다.' });
            }

            if (error.status === 401) {
                return res.status(500).json({ error: 'AI 서비스 인증 실패.' });
            }

            res.status(500).json({
                error: 'AI 응답 처리 중 오류가 발생했습니다.',
                message: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } else {
            // 스트리밍 중 에러 발생
            res.write(`data: ${JSON.stringify({ error: 'AI 응답 처리 중 오류가 발생했습니다.' })}\n\n`);
            res.end();
        }
    }
});

// 문진 결과 분석 엔드포인트
app.post('/api/analyze', async (req, res) => {
    try {
        const {
            category,
            responses,
            language = 'ko',
            gender = 'unknown',
            age = 'unknown',
            redFlagTriggered = false,
            sessionId = '',
            name = '',
            birthdate = '',
            phone = '',
            surveyType = 'rule',
            chatHistory = [],
        } = req.body;

        console.log('📊 Analysis request:', {
            category,
            responsesCount: responses?.length,
            language,
            gender,
            age,
            redFlagTriggered
        });

        if (!responses || !Array.isArray(responses)) {
            return res.status(400).json({ error: '유효하지 않은 요청 데이터' });
        }

        // 문진 데이터를 텍스트로 변환
        const questionnaireText = responses
            .map((r, index) => {
                const answers = Array.isArray(r.answers) ? r.answers.join(', ') : r.answers;
                const redFlagMark = r.is_red_flag ? ' [⚠️ Red Flag]' : '';
                return `${index + 1}. ${r.question}${redFlagMark}\n   Answer: ${answers}`;
            })
            .join('\n\n');

        const languageName = languageMap[language] || 'Korean (한국어)';
        const redFlagStatus = redFlagTriggered
            ? (language === 'ko' ? '예 (위험 신호 감지됨)' : (language === 'vn' || language === 'vi') ? 'Có (Phát hiện tín hiệu nguy hiểm)' : 'Ya (Sinyal bahaya terdeteksi)')
            : (language === 'ko' ? '아니오' : (language === 'vn' || language === 'vi') ? 'Không' : 'Tidak');

        // 언어에 맞는 질병 리스트 선택
        let diseaseList = '';
        if (language === 'ko') {
            diseaseList = prompts.diseases.korean.map(d => `- ${d}`).join('\n');
        } else if (language === 'vn' || language === 'vi') {
            diseaseList = prompts.diseases.vietnamese.map(d => `- ${d}`).join('\n');
        } else if (language === 'id') {
            diseaseList = prompts.diseases.indonesian.map(d => `- ${d}`).join('\n');
        } else {
            diseaseList = prompts.diseases.korean.map(d => `- ${d}`).join('\n');
        }

        const analysisPrompt = prompts.analysis_prompt
            .replace('{language}', languageName)
            .replace('{gender}', gender)
            .replace('{age}', age)
            .replace('{category}', category || 'General')
            .replace('{red_flag_status}', redFlagStatus)
            .replace('{questionnaire_data}', questionnaireText)
            .replace('{disease_list}', diseaseList);

        let analysisJson;
        let totalTokens = 0;

        if (surveyType === 'rule') {
            // ── 선택형 문진 → AI 서버 (Gemma) ──────────────────
            console.log('🤖 Calling AI server (Gemma) for rule-based analysis...');
            const aiServerUrl = AI_SERVER_URL;
            const aiRes = await fetch(`${aiServerUrl}/api/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, responses, language, gender, age, redFlagTriggered }),
            });
            if (!aiRes.ok) throw new Error(`AI server error: ${aiRes.status}`);
            const aiData = await aiRes.json();
            analysisJson = aiData.analysis;
            totalTokens = aiData.tokens || 0;
            console.log(`✅ AI server analysis completed - Tokens: ${totalTokens}`);

        } else {
            // ── 채팅 문진 → OpenAI ──────────────────────────────
            console.log('🤖 Calling OpenAI for chat-based analysis...');
            console.log('📋 Disease List Count:', diseaseList.split('\n').length);

            const completion = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [{ role: 'user', content: analysisPrompt }],
                response_format: { type: 'json_object' },
                max_completion_tokens: 3000,
            });
            const rawContent = completion.choices[0].message.content;
            totalTokens = completion.usage.total_tokens;
            console.log(`✅ OpenAI analysis completed - Tokens: ${totalTokens}`);

            try {
                analysisJson = JSON.parse(rawContent);
            } catch (parseErr) {
                const cleaned = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
                analysisJson = JSON.parse(cleaned);
            }
        }

        res.json({
            analysis: analysisJson,
            category,
            gender,
            age,
            language,
            redFlagTriggered,
            timestamp: new Date().toISOString(),
            tokens: totalTokens
        });

        // Google Sheets 저장 (응답 후 비동기)
        saveToGoogleSheets({
            sessionId,
            language,
            name,
            gender,
            birthdate,
            phone,
            surveyType,
            category,
            redFlagTriggered,
            responses,
            chatHistory,
            analysis: analysisJson,
        });

    } catch (error) {
        console.error('❌ Analysis Error:', error);

        if (error.status === 429) {
            return res.status(429).json({ error: 'API 사용량이 초과되었습니다.' });
        }

        if (error.status === 401) {
            return res.status(500).json({ error: 'AI 서비스 인증 실패.' });
        }

        res.status(500).json({
            error: '분석 처리 중 오류가 발생했습니다.',
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 404 처리
app.use((req, res) => {
    res.status(404).json({ error: '요청한 엔드포인트를 찾을 수 없습니다.' });
});

// 에러 핸들러
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        error: '서버 오류가 발생했습니다.',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log(`🚀 Medical Questionnaire Backend Server`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔑 OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`📝 Prompts: ${prompts ? '✅ Loaded from YAML' : '❌ Failed to load'}`);
    console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
});
