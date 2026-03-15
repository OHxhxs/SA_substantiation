import requests

# vLLM OpenAI Compatible API endpoint
API_URL = "http://localhost:8754/v1/chat/completions"

system_prompt = """
You are MediKoGPT, a gastroenterology diagnostic support AI agent developed by MENINBLOX.
Your role is to analyze the doctor-patient interview content in the section marked ###history_talking and, with reference to the ###Diagnosis_List, determine the patient’s condition.
The output must be in JSON format, and no other output should be provided outside of the section marked ###Output Format.
**you must answer with Indonesian language.**
###Diagnosis_list
[
"Ulkus duodenum",
"Ulkus lambung",
"Sindrom iritasi usus besar (IBS)",
"Kanker lambung",
"Kanker kolon",
"Kanker rektum",
"Gastritis",
"Intoleransi laktosa",
"Kolesistitis akut",
"Pankreatitis kronis",
"Kolitis iskemik",
"Hepatitis toksik",
"Sindrom Gilbert",
"Sindrom Mallory-Weiss",
"Hepatitis virus akut",
"Pankreatitis akut",
"Dispepsia fungsional",
"Stenosis pilorus",
"Kanker saluran empedu (Kolangiokarsinoma)",
"Konstipasi fungsional",
"Perdarahan divertikel",
"Perforasi ulkus peptikum",
"Keracunan makanan",
"Ulkus perforasi gastrointestinal",
"Varises esofagus",
"Hepatitis kronis",
"Kolesistitis kronis",
"Kolelitiasis",
"Konstipasi akibat obat",
"Obstruksi usus",
"Penyakit Wilson",
"Kanker kepala pankreas",
"Rektocele",
"Gastroenteritis akut",
"Kolitis infeksius",
"Kolangitis",
"Diare akibat obat",
"Apendisitis akut",
"Gastroparesis diabetik",
"Esofagitis refluks",
"Divertikulum Meckel",
"Penyakit radang usus (IBD)",
"Penyakit refluks gastroesofageal (GERD)",
"Intususepsi",
"Kanker esofagus",
"Wasir (Hemoroid)",
"Penyakit radang usus",
"Hepatitis akut",
"Kanker hati",
"Sirosis hati",
"Penyakit ulkus peptikum",
"Polip pediatrik",
"Penyakit Crohn"
]

###Output Format

```json{{
"main_symptoms": ["Main symptom keywords"],
"result": [
    {{
        "no": 1,
        "disease": ["First suspected disease name"],
        "patient_edu": ["Patient education content"]
    }},
    {{
        "no": 2,
        "disease": ["Second suspected disease name"],
        "patient_edu": ["Patient education content"]
    }},
    {{
        "no": 3,
        "disease": ["Third suspected disease name"],
        "patient_edu": ["Patient education content"]
    }}
    ]
}}
```
"""

user_input = """
###history_talking
dokter : Boleh saya tahu jenis kelamin Anda?
pasien : Saya perempuan.
dokter : Usia Anda berapa tahun?
pasien : 65 tahun.
dokter : Hari ini, apa keluhan utama yang membuat Anda datang ke sini?
pasien : Perut bagian atas saya terus-terusan sakit dan pencernaan saya tidak lancar, jadi saya datang.
dokter : Sejak kapan Anda mulai merasakan sakit perut?
pasien : Sepertinya sudah sekitar satu atau dua bulan.
dokter : Apakah nyerinya muncul tiba-tiba, atau mulai terasa sakit secara perlahan?
pasien : Awalnya hanya terasa tidak nyaman saja, tapi seiring berjalannya waktu rasanya semakin sakit. Mulainya perlahan-lahan.
dokter : Bagian perut mana yang paling sering terasa sakit?
pasien : Biasanya di bagian ulu hati, perut bagian atas.
dokter : Apakah nyerinya terasa menjalar ke bagian lain?
pasien : Iya. Rasanya seperti ada nyeri tumpul yang menjalar sampai ke punggung.
dokter : Sekali nyerinya muncul, biasanya berlangsung berapa lama?
pasien : Tidak ada waktu spesifik nyerinya membaik, rasanya sakit tumpul hampir sepanjang hari.
dokter : Apakah Anda merasa nyerinya semakin parah seiring waktu?
pasien : Iya, jelas lebih sakit dibandingkan awalnya. Intensitasnya juga rasanya semakin kuat.
dokter : Apakah sebelumnya pernah merasakan sakit perut seperti ini?
pasien : Tidak, ini pertama kalinya saya sakit seperti ini.
dokter : Seperti apa karakteristik nyerinya? Misalnya, apakah seperti diremas, atau terasa seperti terbakar? Bisakah Anda menggambarkannya?
pasien : Bukan seperti ditusuk-tusuk tajam, lebih ke rasa sakit yang tumpul dan pegal terus-menerus.
dokter : Jika kita anggap 0 adalah tidak sakit sama sekali dan 10 adalah nyeri paling hebat yang bisa dibayangkan, kira-kira di angka berapa skala nyeri Anda saat ini?
pasien : Biasanya sekitar skala 5-6, dan kalau sedang parah bisa sampai 7.
dokter : Apakah akhir-akhir ini Anda demam atau menggigil? Atau mungkin berat badan Anda turun tanpa alasan yang jelas?
pasien : Saya tidak demam... tapi berat badan saya turun banyak. Saya tidak sedang diet, tapi dalam beberapa bulan ini turun lebih dari 5 kg.
dokter : Bagaimana dengan nafsu makan Anda? Apakah Anda merasa mual, muntah, atau mengalami sakit kuning (jaundice)?
pasien : Nafsu makan saya juga tidak ada dan rasanya pencernaan tidak lancar. Belakangan ini, warna urin saya menjadi lebih gelap dan bagian putih mata saya juga sepertinya jadi agak kuning.
dokter : Anda bilang warna urin menjadi lebih gelap, apakah ada rasa sakit atau keluhan lain saat buang air kecil?
pasien : Tidak sakit, tapi warnanya menjadi sangat gelap seperti warna teh pekat.
dokter : Apakah ada perubahan pada rasa nyeri setelah makan? Misalnya, apakah nyerinya bertambah parah setelah makan?
pasien : Iya, terutama setelah makan makanan berminyak, perut saya terasa semakin kembung dan nyerinya bertambah parah.
dokter : Apakah nyerinya berubah tergantung posisi tubuh? Misalnya, apakah terasa lebih baik saat Anda membungkuk?
pasien : Iya, benar. Rasanya lebih sakit kalau berbaring telentang, dan sepertinya sedikit lebih baik kalau saya duduk sambil sedikit membungkukkan punggung.
dokter : Kapan terakhir kali Anda menjalani pemeriksaan kesehatan (medical check-up), dan apakah ada temuan yang tidak normal saat itu?
pasien : Saya check-up tahun lalu, dan saat itu katanya semuanya baik-baik saja, termasuk hasil endoskopi lambung.
dokter : Apakah Anda pernah menjalani operasi di bagian perut sebelumnya?
pasien : Tidak, belum pernah.
dokter : Apakah Anda memiliki penyakit yang sedang dalam pengobatan rutin, seperti hipertensi atau diabetes?
pasien : Sebenarnya tidak ada penyakit khusus, tapi saat medical check-up terakhir, katanya gula darah saya agak tinggi.
dokter : Apakah saat ini ada obat yang sedang Anda konsumsi?
pasien : Tidak, tidak ada obat yang saya minum secara rutin.
dokter : Apakah Anda merokok atau mengonsumsi alkohol?
pasien : Dulu waktu muda saya merokok tapi sudah berhenti. Kalau alkohol, saya minum sesekali.
dokter : Apakah ada anggota keluarga inti Anda yang pernah menderita kanker atau penyakit pencernaan?
pasien : Ayah saya meninggal karena kanker pankreas.
dokter : Kapan Anda mengalami menopause? Setelah itu, apakah ada keluhan seperti perdarahan abnormal atau ketidaknyamanan lainnya?
pasien : Sepertinya sudah lebih dari 10 tahun yang lalu. Setelah itu tidak ada masalah khusus.
"""

# Prepare payload in OpenAI format for vLLM
payload = {
    "model": "MENINBLOX/sealion-v3-9b-gemma-checkpoint-2172",
    "messages": [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_input}
    ],
    "max_tokens": 1500,
    "temperature": 0.3,
}

response = requests.post(API_URL, json=payload)
print(response.json())

