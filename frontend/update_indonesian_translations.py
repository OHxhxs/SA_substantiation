#!/usr/bin/env python3
"""
Script to update Indonesian translations for questions and options
in questionnaireData.json
"""

import json

JSON_PATH = "/Users/morant/workspace/SA_valid/frontend/src/data/questionnaireData.json"

# Indonesian translations for all questions
QUESTION_TRANSLATIONS = {
    # CAT001 - Nyeri Perut (Abdominal Pain)
    "CAT001_RF01": "Apakah nyeri muncul tiba-tiba dalam 6 jam terakhir dan menjadi sangat hebat hingga sulit ditahan?",
    "CAT001_RF02": "Apakah Anda mengalami gejala syok seperti pusing, hampir pingsan, jantung berdebar cepat, dan keringat dingin?",
    "CAT001_RF03": "Apakah ada tanda perdarahan saluran cerna seperti tinja hitam, darah merah segar di tinja, atau muntah darah?",
    "CAT001_RF04": "Apakah nyeri semakin hebat saat perut dilepas setelah ditekan, atau seluruh perut terasa kaku dan keras?",
    "CAT001_RF05": "Apakah selama lebih dari 24 jam tidak ada flatus maupun buang air besar sama sekali, dan perut semakin membuncit?",
    "CAT001_RF06": "Apakah ada benjolan yang teraba di perut?",
    "CAT001_RF07": "Apakah Anda mengalami demam tinggi di atas 38°C disertai menggigil dan meriang?",
    "CAT001_RF08": "Apakah Anda sedang hamil atau kemungkinan hamil, dan disertai perdarahan dari vagina?",
    "CAT001_RF09": "Apakah muntah berwarna hijau atau kuning seperti empedu berlangsung lebih dari 24 jam dan tidak dapat menelan makanan maupun air sama sekali?",
    "CAT001_Q01": "Di mana letak nyeri yang Anda rasakan?",
    "CAT001_Q02": "Kapan dan bagaimana nyeri ini mulai muncul?",
    "CAT001_Q03": "Apakah ada gejala lain yang muncul bersamaan?",
    "CAT001_Q04": "Bagaimana hubungan antara nyeri dan makan?",
    "CAT001_Q05": "Dari pilihan berikut, adakah yang memperparah nyeri Anda?",
    "CAT001_Q06": "Bagaimana nyeri Anda setelah buang air besar atau buang angin?",
    "CAT001_Q07": "Pilih semua deskripsi yang paling mendekati rasa nyeri Anda.",

    # CAT002 - Gangguan Pencernaan (Indigestion)
    "CAT002_RF01": "Apakah ada tanda perdarahan saluran cerna seperti tinja hitam, darah merah di tinja, muntah darah, atau muntah berwarna seperti kopi?",
    "CAT002_RF02": "Apakah ada benjolan yang teraba di perut?",
    "CAT002_RF03": "Apakah hasil pemeriksaan atau tes darah menunjukkan anemia defisiensi besi, atau Anda mengalami gejala anemia seperti kelelahan dan pucat?",
    "CAT002_Q01": "Bagaimana gejala ini pertama kali muncul?",
    "CAT002_Q02": "Di mana lokasi utama nyeri atau ketidaknyamanan yang Anda rasakan?",
    "CAT002_Q03": "Bagaimana sifat nyeri atau ketidaknyamanan yang Anda rasakan?",
    "CAT002_Q04": "Bagaimana hubungan gejala dengan waktu makan?",
    "CAT002_Q05": "Apakah ada hubungan antara gejala dan posisi tubuh?",
    "CAT002_Q06": "Apakah ada hubungan antara gejala dan buang air besar?",
    "CAT002_Q07": "Apakah ada gejala lain yang muncul bersamaan?",
    "CAT002_Q08": "Apakah ada faktor gaya hidup atau faktor luar yang memperparah gejala?",
    "CAT002_Q09": "Apakah Anda menderita diabetes?",
    "CAT002_Q10": "Apakah dalam satu bulan terakhir Anda mulai mengonsumsi obat baru atau menaikkan dosis obat tertentu?",

    # CAT003 - Muntah (Vomiting)
    "CAT003_RF01": "Apakah Anda pernah muntah darah atau muntah cairan berwarna seperti kopi?",
    "CAT003_RF02": "Apakah Anda mengalami gejala syok seperti pusing, hampir pingsan, jantung berdebar cepat, dan keringat dingin?",
    "CAT003_RF03": "Apakah muntahan Anda berbau seperti feses?",
    "CAT003_RF04": "Apakah Anda mengalami nyeri perut hebat yang tiba-tiba disertai muntah menyemprot dalam jumlah banyak (muntah proyektil)?",
    "CAT003_RF05": "Apakah Anda mengalami dehidrasi berat selama lebih dari 24 jam—tidak dapat menelan air, mulut kering, dan produksi urine hampir tidak ada?",
    "CAT003_RF06": "Apakah selama lebih dari 24 jam tidak ada flatus maupun buang air besar sama sekali, dan perut semakin membuncit?",
    "CAT003_RF07": "Apakah ada gangguan neurologis seperti sakit kepala hebat, penglihatan kabur, atau kebingungan?",
    "CAT003_RF08": "Apakah Anda sedang hamil dan tidak dapat menelan makanan atau air, serta berat badan turun lebih dari 5% dari berat sebelum hamil?",
    "CAT003_RF09": "Apakah muntah berlangsung lebih dari 48 jam tanpa henti atau semakin memburuk?",
    "CAT003_Q01": "Sudah berapa lama Anda mengalami muntah?",
    "CAT003_Q02": "Apakah orang yang makan bersama Anda juga mengalami gejala serupa?",
    "CAT003_Q03": "Selain muntah, apakah ada gejala lain yang muncul?",
    "CAT003_Q04": "Kapan muntah biasanya terjadi?",
    "CAT003_Q05": "Rata-rata berapa kali Anda muntah per hari?",
    "CAT003_Q06": "Apakah isi muntahan Anda mengandung hal-hal berikut?",
    "CAT003_Q07": "Di mana lokasi dan bagaimana sifat rasa panas atau nyeri yang Anda rasakan?",
    "CAT003_Q08": "Jika ada nyeri atau rasa panas, bagaimana hubungannya dengan kondisi berikut?",
    "CAT003_Q09": "Apakah Anda merasa cepat kenyang atau kembung yang parah setelah makan?",
    "CAT003_Q10": "Apakah ada gejala lain yang menyertai?",
    "CAT003_Q11": "Apakah Anda memiliki diabetes, sedang hamil, atau penyakit sistem saraf?",
    "CAT003_Q12": "Apakah dalam sebulan terakhir Anda mengonsumsi obat tertentu atau memiliki kebiasaan tertentu?",

    # CAT004 - Diare (Diarrhea)
    "CAT004_RF01": "Apakah Anda pernah buang air besar berupa tinja hitam atau darah merah segar?",
    "CAT004_RF02": "Apakah diare cair berlangsung lebih dari 10 kali sehari selama lebih dari 24 jam?",
    "CAT004_RF03": "Apakah Anda mengalami dehidrasi berat hingga hampir tidak ada urine yang keluar?",
    "CAT004_RF04": "Apakah Anda mengalami demam tinggi di atas 38°C disertai menggigil dan meriang?",
    "CAT004_RF05": "Apakah nyeri semakin hebat saat perut dilepas setelah ditekan, atau perut sangat kembung dan keras?",
    "CAT004_RF06": "Apakah Anda berusia 65 tahun atau lebih, atau mengalami penurunan imunitas akibat kemoterapi atau transplantasi organ, dan diare tidak berhenti selama lebih dari 24 jam?",
    "CAT004_Q01": "Sejak kapan diare mulai?",
    "CAT004_Q02": "Bagaimana gejala ini mulai muncul?",
    "CAT004_Q03": "Rata-rata berapa kali buang air besar per hari?",
    "CAT004_Q04": "Bagaimana bentuk dan sifat tinja Anda?",
    "CAT004_Q05": "Apakah ada gejala penyerta berikut?",
    "CAT004_Q06": "Apakah gejala memburuk setelah mengonsumsi makanan tertentu?",
    "CAT004_Q07": "Apakah dalam 4 minggu terakhir Anda mulai mengonsumsi obat baru atau mengubah dosis obat?",
    "CAT004_Q08": "Apakah Anda bepergian ke luar negeri dalam 1 bulan terakhir?",
    "CAT004_Q09": "Apakah nyeri perut berkurang setelah buang air besar?",
    "CAT004_Q10": "Apakah Anda terbangun dari tidur malam karena diare?",

    # CAT005 - Ikterus/Jaundice (Kulit & Mata Menguning)
    "CAT005_RF01": "Apakah Anda mengalami demam tinggi di atas 38°C disertai menggigil dan meriang?",
    "CAT005_RF02": "Apakah Anda mengalami nyeri perut hebat di kanan atas atau di ulu hati?",
    "CAT005_RF03": "Apakah ada perubahan kesadaran seperti kantuk berlebihan, kebingungan, atau bicara melambat?",
    "CAT005_RF04": "Apakah urine menjadi sangat gelap seperti warna cola, atau tinja menjadi berwarna putih abu-abu seperti tanah liat?",
    "CAT005_RF05": "Apakah Anda lebih mudah memar dari biasanya, atau mudah mengalami mimisan atau perdarahan gusi?",
    "CAT005_RF06": "Apakah Anda sedang hamil trimester akhir atau baru melahirkan dan mengalami nyeri perut atas serta muntah?",
    "CAT005_Q01": "Sejak kapan wajah atau mata Anda mulai menguning?",
    "CAT005_Q02": "Bagian mana yang pertama kali menguning?",
    "CAT005_Q03": "Bagaimana penyebaran warna kuning tersebut?",
    "CAT005_Q04": "Apakah Anda pernah mengalami gejala yang sama sebelumnya?",
    "CAT005_Q05": "Bagaimana nuansa warna kuningnya?",
    "CAT005_Q06": "Apakah dalam 2 minggu terakhir Anda banyak mengonsumsi sayuran atau buah berwarna kuning-oranye seperti wortel, labu, atau jeruk?",
    "CAT005_Q07": "Apakah ada gejala lain yang muncul bersamaan?",
    "CAT005_Q08": "Apakah ada faktor yang memperparah gejala?",
    "CAT005_Q09": "Apakah Anda sudah mendapatkan vaksinasi hepatitis B?",
    "CAT005_Q10": "Apakah Anda pernah berisiko terpapar hepatitis B (transfusi darah, berbagi jarum suntik, atau hubungan seksual)?",
    "CAT005_Q11": "Bagaimana warna urine Anda saat ini?",

    # CAT006 - Sembelit (Constipation)
    "CAT006_RF01": "Apakah Anda pernah buang air besar berupa tinja hitam atau darah merah segar?",
    "CAT006_RF02": "Apakah selama lebih dari 24 jam tidak ada tinja maupun flatus sama sekali, dan perut semakin membuncit?",
    "CAT006_RF03": "Apakah Anda mengalami demam tinggi di atas 38°C disertai menggigil dan meriang?",
    "CAT006_RF04": "Apakah hasil pemeriksaan atau tes darah menunjukkan anemia defisiensi besi, atau Anda mengalami gejala anemia seperti kelelahan dan pucat?",
    "CAT006_Q01": "Sejak kapan sembelit ini mulai?",
    "CAT006_Q02": "Bagaimana gejala pertama kali muncul?",
    "CAT006_Q03": "Berapa kali Anda buang air besar dalam 1 minggu terakhir?",
    "CAT006_Q04": "Bagaimana perubahan gejala dari awal hingga sekarang?",
    "CAT006_Q05": "Bagaimana bentuk tinja Anda belakangan ini?",
    "CAT006_Q06": "Apakah ada ketidaknyamanan saat buang air besar?",
    "CAT006_Q07": "(Gejala penyerta) Apakah ada yang sesuai dengan kondisi di bawah ini?",
    "CAT006_Q08": "Apakah Anda sedang mengonsumsi obat-obatan tertentu?",
}

# Indonesian translations for all options
OPTION_TRANSLATIONS = {
    # CAT001_Q01 - Location of pain
    "CAT001_Q01_O01": "Perut atas (ulu hati)",
    "CAT001_Q01_O02": "Perut kanan atas",
    "CAT001_Q01_O03": "Perut kiri atas",
    "CAT001_Q01_O04": "Perut kanan bawah",
    "CAT001_Q01_O05": "Perut kiri bawah",
    "CAT001_Q01_O06": "Seluruh perut / tersebar",
    "CAT001_Q01_O07": "Tidak tahu / tidak yakin",

    # CAT001_Q02 - Onset
    "CAT001_Q02_O01": "Tiba-tiba (cepat dalam beberapa jam hingga 1-2 hari)",
    "CAT001_Q02_O02": "Perlahan (bertahap selama beberapa minggu atau lebih)",
    "CAT001_Q02_O03": "Tidak ingat / tidak yakin",

    # CAT001_Q03 - Associated symptoms
    "CAT001_Q03_O01": "Demam",
    "CAT001_Q03_O02": "Diare",
    "CAT001_Q03_O03": "Sembelit",
    "CAT001_Q03_O04": "Mual / muntah",
    "CAT001_Q03_O05": "Perubahan warna urine atau tinja (urine gelap / tinja putih keabu-abuan)",
    "CAT001_Q03_O06": "Nafsu makan berkurang / penurunan berat badan belakangan ini",
    "CAT001_Q03_O07": "Ikterus (mata atau kulit menguning)",
    "CAT001_Q03_O08": "Tidak ada / tidak tahu",

    # CAT001_Q04 - Relation to meals
    "CAT001_Q04_O01": "Nyeri memburuk setelah makan",
    "CAT001_Q04_O02": "Lebih parah saat perut kosong atau malam hari",
    "CAT001_Q04_O03": "Berkurang setelah makan sedikit atau minum antasida",
    "CAT001_Q04_O04": "Memburuk setelah makanan berlemak atau makan terlalu banyak",
    "CAT001_Q04_O05": "Tidak ada hubungan yang jelas / tidak tahu",

    # CAT001_Q05 - Aggravating factors
    "CAT001_Q05_O01": "Alkohol / kafein",
    "CAT001_Q05_O02": "Obat pereda nyeri (aspirin, ibuprofen, dll.)",
    "CAT001_Q05_O03": "Saat perut ditekan",
    "CAT001_Q05_O04": "Olahraga berat / aktivitas fisik intens",
    "CAT001_Q05_O05": "Tepat sebelum buang air besar (saat ingin BAB)",
    "CAT001_Q05_O06": "Stres / ketegangan",
    "CAT001_Q05_O07": "Tidak ada / tidak tahu",

    # CAT001_Q06 - After defecation
    "CAT001_Q06_O01": "Berkurang",
    "CAT001_Q06_O02": "Tidak ada perbedaan",
    "CAT001_Q06_O03": "Tidak yakin",

    # CAT001_Q07 - Pain character
    "CAT001_Q07_O01": "Terasa panas seperti terbakar",
    "CAT001_Q07_O02": "Terasa perih seperti lapar, berkurang setelah makan sedikit",
    "CAT001_Q07_O03": "Tajam seperti ditusuk atau diiris pisau",
    "CAT001_Q07_O04": "Kram berulang seperti diperas atau dipilin",
    "CAT001_Q07_O05": "Berat dan tumpul seperti pegal",
    "CAT001_Q07_O06": "Perut terasa kembung dan penuh seperti bergas",
    "CAT001_Q07_O07": "Lebih terasa kembung dan mual daripada nyeri",
    "CAT001_Q07_O08": "Sulit digambarkan / tidak sesuai",

    # CAT002_Q01 - Onset of symptoms
    "CAT002_Q01_O01": "Muncul tiba-tiba dan mendadak",
    "CAT002_Q01_O02": "Berkembang dan memburuk secara bertahap",
    "CAT002_Q01_O03": "Tidak ingat / sulit dibedakan",

    # CAT002_Q02 - Location
    "CAT002_Q02_O01": "Perut atas (sekitar ulu hati)",
    "CAT002_Q02_O02": "Perut kanan atas (di bawah tulang rusuk kanan)",
    "CAT002_Q02_O03": "Perut kiri atas (di bawah tulang rusuk kiri)",
    "CAT002_Q02_O04": "Perut kanan bawah",
    "CAT002_Q02_O05": "Perut kiri bawah",
    "CAT002_Q02_O06": "Seluruh perut / tersebar di mana-mana",
    "CAT002_Q02_O07": "Tidak tahu / tidak yakin",

    # CAT002_Q03 - Pain character
    "CAT002_Q03_O01": "Terasa panas atau terbakar",
    "CAT002_Q03_O02": "Tajam seperti diperas atau diiris pisau",
    "CAT002_Q03_O03": "Berat dan tumpul",
    "CAT002_Q03_O04": "Nyeri dalam yang menembus ke punggung",
    "CAT002_Q03_O05": "Kembung, bergas, atau bersifat kram",
    "CAT002_Q03_O06": "Gejala utama berupa kembung dan cepat kenyang, bukan nyeri",

    # CAT002_Q04 - Relation to meals
    "CAT002_Q04_O01": "Memburuk segera setelah makan",
    "CAT002_Q04_O02": "Memburuk saat perut kosong atau malam hari, dan membaik dengan makan atau antasida",
    "CAT002_Q04_O03": "Memburuk setelah makanan berlemak atau tinggi lemak",
    "CAT002_Q04_O04": "Diare atau ketidaknyamanan muncul setelah mengonsumsi produk susu",
    "CAT002_Q04_O05": "Kembung atau muntah memburuk setelah makan banyak",
    "CAT002_Q04_O06": "Tidak ada hubungan jelas dengan makan / tidak tahu",

    # CAT002_Q05 - Relation to posture
    "CAT002_Q05_O01": "Memburuk saat berbaring atau membungkuk, membaik saat berdiri tegak",
    "CAT002_Q05_O02": "Membaik saat tubuh membungkuk ke depan",
    "CAT002_Q05_O03": "Tidak ada hubungan jelas dengan posisi / tidak tahu",

    # CAT002_Q06 - Relation to defecation
    "CAT002_Q06_O01": "Gejala membaik jelas setelah buang air besar",
    "CAT002_Q06_O02": "Tidak ada hubungan jelas dengan buang air besar / tidak tahu",

    # CAT002_Q07 - Associated symptoms
    "CAT002_Q07_O01": "Regurgitasi asam / tenggorokan terasa panas",
    "CAT002_Q07_O02": "Mual / muntah",
    "CAT002_Q07_O03": "Penurunan berat badan yang terlihat jelas",
    "CAT002_Q07_O04": "Berat badan justru bertambah",
    "CAT002_Q07_O05": "Diare encer / banyak gas",
    "CAT002_Q07_O06": "Tinja berminyak (steatorrhea)",
    "CAT002_Q07_O07": "Mata atau kulit menguning, atau kelelahan ekstrem",
    "CAT002_Q07_O08": "Tidak ada / tidak tahu",

    # CAT002_Q08 - Aggravating lifestyle factors
    "CAT002_Q08_O01": "Memburuk saat minum alkohol",
    "CAT002_Q08_O02": "Memburuk dalam situasi stres atau tegang",
    "CAT002_Q08_O03": "Tidak ada / tidak tahu",

    # CAT002_Q09 - Diabetes
    "CAT002_Q09_O01": "Ya, sudah lebih dari 5 tahun",
    "CAT002_Q09_O02": "Ya, didiagnosis dalam 5 tahun terakhir",
    "CAT002_Q09_O03": "Tidak",
    "CAT002_Q09_O04": "Tidak tahu / belum pernah diperiksa",

    # CAT002_Q10 - Medications
    "CAT002_Q10_O01": "Obat pereda nyeri / anti-inflamasi (aspirin, ibuprofen, dll.)",
    "CAT002_Q10_O02": "Suplemen zat besi, kalsium, dll.",
    "CAT002_Q10_O03": "Antibiotik",
    "CAT002_Q10_O04": "Steroid / imunosupresan",
    "CAT002_Q10_O05": "Obat herbal / suplemen kesehatan",
    "CAT002_Q10_O06": "Obat resep lainnya / tidak tahu nama",
    "CAT002_Q10_O07": "Tidak ada obat baru yang dikonsumsi",

    # CAT003_Q01 - Duration of vomiting
    "CAT003_Q01_O01": "Kurang dari 24 jam",
    "CAT003_Q01_O02": "1–7 hari",
    "CAT003_Q01_O03": "Lebih dari 1 minggu hingga kurang dari 1 bulan",
    "CAT003_Q01_O04": "Lebih dari 1 bulan, berulang",

    # CAT003_Q02 - Others with same symptoms
    "CAT003_Q02_O01": "Ya",
    "CAT003_Q02_O02": "Tidak",

    # CAT003_Q03 - Associated symptoms
    "CAT003_Q03_O01": "Diare",
    "CAT003_Q03_O02": "Demam 38°C atau lebih",
    "CAT003_Q03_O03": "Diare dan demam keduanya",
    "CAT003_Q03_O04": "Tidak ada",

    # CAT003_Q04 - Timing of vomiting
    "CAT003_Q04_O01": "Dalam 30 menit setelah makan",
    "CAT003_Q04_O02": "1–3 jam setelah makan",
    "CAT003_Q04_O03": "Saat perut kosong / malam atau dini hari",
    "CAT003_Q04_O04": "Regurgitasi saat berbaring atau membungkuk, lalu muntah",
    "CAT003_Q04_O05": "Tidak teratur, tidak ada hubungan dengan waktu tertentu",

    # CAT003_Q05 - Frequency
    "CAT003_Q05_O01": "1–2 kali",
    "CAT003_Q05_O02": "3–5 kali",
    "CAT003_Q05_O03": "6 kali atau lebih",
    "CAT003_Q05_O04": "Kurang dari sekali seminggu, tapi berlangsung lebih dari 1 bulan",

    # CAT003_Q06 - Vomit contents
    "CAT003_Q06_O01": "Sisa makanan",
    "CAT003_Q06_O02": "Cairan kuning / hijau (empedu)",
    "CAT003_Q06_O03": "Hanya cairan asam",
    "CAT003_Q06_O04": "Tidak ada / sulit dipastikan",

    # CAT003_Q07 - Heartburn/pain location
    "CAT003_Q07_O01": "Nyeri atau panas di dada",
    "CAT003_Q07_O02": "Nyeri atau panas di ulu hati",
    "CAT003_Q07_O03": "Hampir tidak ada nyeri atau rasa panas",

    # CAT003_Q08 - Relation to conditions
    "CAT003_Q08_O01": "Memburuk setelah makan",
    "CAT003_Q08_O02": "Lebih parah saat perut kosong atau malam hari, membaik setelah makan",
    "CAT003_Q08_O03": "Memburuk saat berbaring atau membungkuk",
    "CAT003_Q08_O04": "Tidak ada",

    # CAT003_Q09 - Early satiety/bloating
    "CAT003_Q09_O01": "Ya",
    "CAT003_Q09_O02": "Tidak",

    # CAT003_Q10 - Other symptoms
    "CAT003_Q10_O01": "Penurunan berat badan signifikan (lebih dari 5% baru-baru ini)",
    "CAT003_Q10_O02": "Sakit kepala, pusing, atau kecemasan",
    "CAT003_Q10_O03": "Batuk malam atau sesak napas",
    "CAT003_Q10_O04": "Nyeri otot / badan pegal",
    "CAT003_Q10_O05": "Tidak ada yang khusus",

    # CAT003_Q11 - Underlying conditions
    "CAT003_Q11_O01": "Diabetes jangka panjang (lebih dari 5 tahun)",
    "CAT003_Q11_O02": "Kehamilan",
    "CAT003_Q11_O03": "Penyakit sistem saraf (Parkinson, dll.)",
    "CAT003_Q11_O04": "Tidak ada",

    # CAT003_Q12 - Medications/habits
    "CAT003_Q12_O01": "NSAID / aspirin",
    "CAT003_Q12_O02": "Antikoagulan / antiplatelet",
    "CAT003_Q12_O03": "Steroid",
    "CAT003_Q12_O04": "Opioid / agen antikolinergik",
    "CAT003_Q12_O05": "Obat diet / suntikan GLP-1",
    "CAT003_Q12_O06": "Konsumsi alkohol berlebihan",
    "CAT003_Q12_O07": "Tidak ada",

    # CAT004_Q01 - Onset of diarrhea
    "CAT004_Q01_O01": "Hari ini",
    "CAT004_Q01_O02": "1–3 hari yang lalu",
    "CAT004_Q01_O03": "1–2 minggu yang lalu",
    "CAT004_Q01_O04": "2–4 minggu yang lalu",
    "CAT004_Q01_O05": "Lebih dari 1 bulan",

    # CAT004_Q02 - How symptoms started
    "CAT004_Q02_O01": "Mulai secara tiba-tiba",
    "CAT004_Q02_O02": "Berlangsung secara bertahap dan terus-menerus",

    # CAT004_Q03 - Frequency per day
    "CAT004_Q03_O01": "≤2 kali",
    "CAT004_Q03_O02": "3–5 kali",
    "CAT004_Q03_O03": "6–9 kali",
    "CAT004_Q03_O04": "≥10 kali",

    # CAT004_Q04 - Stool character
    "CAT004_Q04_O01": "Diare cair",
    "CAT004_Q04_O02": "Tinja berminyak (steatorrhea)",
    "CAT004_Q04_O03": "Tinja lembek / setengah cair",
    "CAT004_Q04_O04": "Tidak ada",

    # CAT004_Q05 - Associated symptoms
    "CAT004_Q05_O01": "Nyeri perut",
    "CAT004_Q05_O02": "Muntah",
    "CAT004_Q05_O03": "Demam 38°C atau lebih",
    "CAT004_Q05_O04": "Penurunan berat badan lebih dari 5% dalam 4 minggu terakhir",
    "CAT004_Q05_O05": "Diare malam hari",
    "CAT004_Q05_O06": "Nyeri sendi",
    "CAT004_Q05_O07": "Tidak ada",

    # CAT004_Q06 - Food triggers
    "CAT004_Q06_O01": "Susu / produk susu",
    "CAT004_Q06_O02": "Makanan berlemak",
    "CAT004_Q06_O03": "Makanan pedas",
    "CAT004_Q06_O04": "Tidak ada / tidak tahu",

    # CAT004_Q07 - Medications
    "CAT004_Q07_O01": "Antibiotik",
    "CAT004_Q07_O02": "NSAID (obat anti-inflamasi non-steroid)",
    "CAT004_Q07_O03": "Metformin (Diabex) atau obat diabetes",
    "CAT004_Q07_O04": "Obat diare / pencahar",
    "CAT004_Q07_O05": "Tidak ada",

    # CAT004_Q08 - Travel history
    "CAT004_Q08_O01": "Perjalanan ke Asia Tenggara atau Afrika",
    "CAT004_Q08_O02": "Tidak",

    # CAT004_Q09 - After defecation
    "CAT004_Q09_O01": "Ya",
    "CAT004_Q09_O02": "Tidak",
    "CAT004_Q09_O03": "Tidak ada nyeri perut",

    # CAT004_Q10 - Nocturnal diarrhea
    "CAT004_Q10_O01": "Ya",
    "CAT004_Q10_O02": "Tidak",

    # CAT005_Q01 - Onset of jaundice
    "CAT005_Q01_O01": "Tiba-tiba dalam 4 minggu terakhir",
    "CAT005_Q01_O02": "Perlahan sejak 1–3 bulan lalu",
    "CAT005_Q01_O03": "Hilang timbul sejak lebih dari 3 bulan lalu",
    "CAT005_Q01_O04": "Tidak tahu",

    # CAT005_Q02 - First area to yellow
    "CAT005_Q02_O01": "Mulai dari mata",
    "CAT005_Q02_O02": "Mulai dari kulit",
    "CAT005_Q02_O03": "Mata dan kulit hampir bersamaan",
    "CAT005_Q02_O04": "Tidak tahu",

    # CAT005_Q03 - Spread of yellowing
    "CAT005_Q03_O01": "Menyebar ke seluruh tubuh dengan cepat dalam beberapa hari",
    "CAT005_Q03_O02": "Menyebar perlahan selama lebih dari 1 minggu",
    "CAT005_Q03_O03": "Hilang timbul",
    "CAT005_Q03_O04": "Tidak berubah / tidak tahu",

    # CAT005_Q04 - Previous episode
    "CAT005_Q04_O01": "Ini pertama kalinya",
    "CAT005_Q04_O02": "Sudah beberapa kali",
    "CAT005_Q04_O03": "Pernah kadang-kadang atau sementara",
    "CAT005_Q04_O04": "Tidak tahu",

    # CAT005_Q05 - Shade of yellow
    "CAT005_Q05_O01": "Kuning kehijauan tua / kuning kecoklatan",
    "CAT005_Q05_O02": "Kuning lemon muda",
    "CAT005_Q05_O03": "Oranye / warna wortel",
    "CAT005_Q05_O04": "Sulit dibedakan",

    # CAT005_Q06 - Carotenoid intake
    "CAT005_Q06_O01": "Setiap hari dalam jumlah banyak",
    "CAT005_Q06_O02": "Kadang-kadang",
    "CAT005_Q06_O03": "Hampir tidak / sama sekali tidak",

    # CAT005_Q07 - Associated symptoms
    "CAT005_Q07_O01": "Lesu, nafsu makan hilang, demam, urine hitam",
    "CAT005_Q07_O02": "Nyeri perut atas atau punggung, tinja berminyak",
    "CAT005_Q07_O03": "Perut penuh cairan (asites), bintik merah di kulit, kaki bengkak",
    "CAT005_Q07_O04": "Penurunan berat badan",
    "CAT005_Q07_O05": "Tidak ada gejala khusus",
    "CAT005_Q07_O06": "Lainnya / tidak tahu",

    # CAT005_Q08 - Aggravating factors
    "CAT005_Q08_O01": "Setelah minum alkohol berlebihan",
    "CAT005_Q08_O02": "Obat baru, herbal, atau suplemen kesehatan",
    "CAT005_Q08_O03": "Setelah puasa, kelelahan, atau stres",
    "CAT005_Q08_O04": "Tidak terkait makanan berlemak atau alkohol",
    "CAT005_Q08_O05": "Tidak tahu / tidak ada",

    # CAT005_Q09 - Hep B vaccination
    "CAT005_Q09_O01": "Sudah vaksinasi lengkap",
    "CAT005_Q09_O02": "Belum vaksinasi",
    "CAT005_Q09_O03": "Tidak tahu",

    # CAT005_Q10 - Hep B exposure risk
    "CAT005_Q10_O01": "Ada dalam 1 tahun terakhir",
    "CAT005_Q10_O02": "Ada, lebih dari 1 tahun yang lalu",
    "CAT005_Q10_O03": "Tidak ada",
    "CAT005_Q10_O04": "Tidak yakin",

    # CAT005_Q11 - Current urine color
    "CAT005_Q11_O01": "Coklat tua seperti cola / hitam kecoklatan",
    "CAT005_Q11_O02": "Kuning lebih pekat dari biasanya",
    "CAT005_Q11_O03": "Kuning terang / tidak berubah",
    "CAT005_Q11_O04": "Tidak tahu",

    # CAT006_Q01 - Onset of constipation
    "CAT006_Q01_O01": "Berlangsung lebih dari 3 bulan",
    "CAT006_Q01_O02": "Mulai dalam 3 bulan terakhir",
    "CAT006_Q01_O03": "Tidak ingat / tidak tahu",

    # CAT006_Q02 - How it started
    "CAT006_Q02_O01": "Muncul perlahan, sedikit demi sedikit",
    "CAT006_Q02_O02": "Tiba-tiba muncul dalam semalam",
    "CAT006_Q02_O03": "Tidak ingat",

    # CAT006_Q03 - Frequency in 1 week
    "CAT006_Q03_O01": "0–2 kali",
    "CAT006_Q03_O02": "3–7 kali",
    "CAT006_Q03_O03": "8 kali atau lebih",

    # CAT006_Q04 - Symptom progression
    "CAT006_Q04_O01": "Semakin parah seiring waktu",
    "CAT006_Q04_O02": "Silih berganti membaik dan memburuk",
    "CAT006_Q04_O03": "Hampir tidak berubah",

    # CAT006_Q05 - Stool consistency
    "CAT006_Q05_O01": "Keras",
    "CAT006_Q05_O02": "Normal",
    "CAT006_Q05_O03": "Lembek",

    # CAT006_Q06 - Defecation difficulty
    "CAT006_Q06_O01": "Harus mengejan keras",
    "CAT006_Q06_O02": "Harus dikeluarkan dengan jari atau alat bantu",
    "CAT006_Q06_O03": "Perlu menekan vagina atau perineum agar bisa BAB",
    "CAT006_Q06_O04": "Tidak ada ketidaknyamanan khusus",

    # CAT006_Q07 - Associated symptoms
    "CAT006_Q07_O01": "Ada nyeri perut dan kembung sebelum BAB, berkurang setelah BAB",
    "CAT006_Q07_O02": "Ada nyeri perut dan kembung, tapi tidak berhubungan dengan BAB",
    "CAT006_Q07_O03": "Ada penyakit atau cedera sistem saraf (Parkinson, cedera tulang belakang, dll.)",
    "CAT006_Q07_O04": "Ada rasa menonjol di dinding vagina / ketidaknyamanan dasar panggul pasca melahirkan",
    "CAT006_Q07_O05": "Tidak ada / tidak tahu",

    # CAT006_Q08 - Medications
    "CAT006_Q08_O01": "Analgesik opioid (morfin, kodein, dll.)",
    "CAT006_Q08_O02": "Suplemen zat besi",
    "CAT006_Q08_O03": "Penghambat saluran kalsium / diuretik",
    "CAT006_Q08_O04": "Agen antikolinergik / antihistamin",
    "CAT006_Q08_O05": "Sedang menggunakan Wegovy atau Mounjaro",
    "CAT006_Q08_O06": "Tidak ada",
}


def update_translations(json_path: str) -> None:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    question_count = 0
    option_count = 0
    question_missing = []
    option_missing = []

    # Update questions
    for question in data.get("Question", []):
        qid = question.get("question_id")
        if qid in QUESTION_TRANSLATIONS:
            question["question_text_id"] = QUESTION_TRANSLATIONS[qid]
            question_count += 1
        else:
            question_missing.append(qid)

    # Update options
    for option in data.get("Option", []):
        oid = option.get("option_id")
        if oid in OPTION_TRANSLATIONS:
            option["option_text_id"] = OPTION_TRANSLATIONS[oid]
            option_count += 1
        else:
            option_missing.append(oid)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Updated {question_count} question translations.")
    print(f"Updated {option_count} option translations.")

    if question_missing:
        print(f"\nQuestions NOT in translation dict ({len(question_missing)}):")
        for qid in question_missing:
            print(f"  {qid}")

    if option_missing:
        print(f"\nOptions NOT in translation dict ({len(option_missing)}):")
        for oid in option_missing:
            print(f"  {oid}")

    print("\nDone! File updated successfully.")


if __name__ == "__main__":
    update_translations(JSON_PATH)
