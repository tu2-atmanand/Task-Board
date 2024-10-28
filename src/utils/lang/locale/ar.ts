const ar = {
  1: "يحفظ",
  2: "يغلق",
  3: "أرشيف",
  4: "لوحة المهام المفتوحة",
  5: "إعادة مسح الخزنة",
  6: "لم يتم العثور على ملف نشط لإضافة مهمة.",
  7: "لا توجد مهام متاحة",
  8: "تحرير المهمة",
  9: "حذف المهمة",
  10: "نوع العمود",
  11: "بدون تاريخ",
  12: "مؤرخة",
  13: "تم وضع علامة",
  14: "غير مُميز",
  15: "مكتمل",
  16: "علامات أخرى",
  17: "اسم العمود",
  18: "يُقدِّم",
  19: "يلغي",
  20: "أدخل اسم العمود",
  21: "تحرير المهمة",
  22: "إضافة مهمة جديدة",
  23: "عنوان المهمة",
  24: "المهام الفرعية",
  25: "معاينة",
  26: "محرر",
  27: "فتح الملف",
  28: "قم بتعديل أو إضافة وصف للمهمة أو إضافة المزيد من المهام الفرعية.",
  29: "محتوى الجسم",
  30: "وقت بدء المهمة",
  31: "وقت انتهاء المهمة",
  32: "تاريخ استحقاق المهمة",
  33: "أولوية المهمة",
  34: "علامة المهمة",
  35: "لم يتم تحديد أي لوحة للحذف.",
  36: "الإعدادات العالمية للمكون الإضافي",
  37: "إعدادات",
  38: "اسم اللوحة",
  39: "اسم اللوحة التي ستظهر كعلامة تبويب في رأس علامة التبويب داخل البرنامج المساعد.",
  40: "إظهار العلامات لأعمدة نوع العلامة المسماة",
  41: "يعمل فقط مع أعمدة نوع العلامة المسماة. إذا كنت لا تريد رؤية العلامة على البطاقة الخاصة بنوع العمود.",
  42: "علامات التصفية",
  43: "أدخل العلامات، مفصولة بفاصلة، التي تريد رؤيتها في هذه اللوحة. سيتم عرض المهام التي تحمل هذه العلامات فقط.",
  44: "فلتر القطبية",
  45: "قم بتنشيط أو إلغاء تنشيط علامات التصفية المذكورة أعلاه داخل اللوحات.",
  46: "فعل",
  47: "إلغاء التنشيط",
  48: "إظهار العلامات المفلترة",
  49: "ما إذا كان سيتم عرض العلامات المصفاة المذكورة أعلاه على بطاقة عنصر المهمة.",
  50: "الأعمدة",
  51: "أدخل العلامة",
  52: "الحد الأقصى للعناصر",
  53: "من",
  54: "ل",
  55: "حذف العمود",
  56: "إضافة عمود",
  57: "حذف هذه اللوحة",
  58: "الإعدادات العالمية",
  59: "إضافة لوحة",
  60: "تأكيد الحذف",
  61: "هل أنت متأكد أنك تريد حذف هذه المهمة؟",
  62: "نعم",
  63: "لا",
  64: "تم الانتهاء من فحص الخزنة.",
  65: "مهام المسح الضوئي من الخزنة",
  66: "قم بتشغيل هذه الميزة فقط إذا لم يتم اكتشاف مهامك أو مسحها ضوئيًا بشكل صحيح أو إذا كانت اللوحة تتصرف بشكل غريب.",
  67: "لا يتعين عليك تشغيل هذه الميزة كثيرًا، حيث سيقوم المكون الإضافي تلقائيًا باكتشاف المهام المضافة/المحررة حديثًا.",
  68: "ملاحظة: يرجى التحقق من مرشحات فحص الملفات من إعدادات البرنامج المساعد أولاً، إذا كنت تقوم بتشغيل هذه الوظيفة لفحص المهام غير المكتشفة.",
  69: "يجري",
  70: "إخفاء المهام التي تم جمعها",
  71: "إظهار المهام المجمعة",
  72: "فشل تحميل الإعدادات.",
  73: "يرجى قراءة الوثائق لاستخدام البرنامج الإضافي بكفاءة:",
  74: "وثائق لوحة المهام",
  75: "مرشحات المسح الضوئي",
  76: "فقط قم بمسح هذا",
  77: "لا تفحص هذا",
  78: "إبطال",
  79: "إعدادات واجهة المستخدم للوحة",
  80: "إظهار رأس بطاقة عنصر المهمة",
  81: "قم بتمكين هذا لرؤية العنوان في بطاقة عنصر المهمة",
  82: "إظهار تذييل بطاقة عنصر المهمة",
  83: "قم بتمكين هذا لرؤية التذييل في بطاقة عنصر المهمة",
  84: "عرض كل عمود",
  85: "أدخل قيمة العرض لكل عمود. القيمة الافتراضية هي 273 بكسل",
  86: "إظهار شريط التمرير العمودي",
  87: "تمكين عرض شريط التمرير لكل عمود. سيؤدي هذا إلى تقليل عرض بطاقات المهام.",
  88: "ألوان العلامة",
  89: "يمسح",
  90: "إضافة لون العلامة",
  91: "اسم العلامة",
  92: "إعدادات الأتمتة",
  93: "المسح في الوقت الحقيقي",
  94: "بعد فقدان التركيز من الملف الذي قمت بتحريره، سيتم تحديث المهمة على الفور على لوحة المهام.\nسيؤدي تعطيل هذا الإعداد إلى مسح الملفات المعدلة بعد مرور بعض الوقت.",
  95: "إضافة تاريخ الاستحقاق تلقائيًا إلى المهام",
  96: "عند تمكين هذا الخيار، إذا قمت بإضافة مهمة باستخدام النافذة المنبثقة إضافة مهمة جديدة، فسيتم إضافة تاريخ اليوم كتاريخ استحقاق، إذا لم يتم إدخال القيمة.",
  97: "المسح التلقائي للخزنة عند بدء تشغيل Obsidian",
  98: "استخدم هذه الميزة فقط إذا لم يتم اكتشاف مهامك. عادةً ما يتم اكتشاف جميع المهام التي تمت إضافتها/تحريرها حديثًا بشكل مباشر.",
  99: "إذا كان خزنتك تحتوي على عدد كبير من الملفات ذات البيانات الضخمة، فقد يؤثر هذا على وقت بدء تشغيل Obsidian.",
  100: "إعدادات التوافق",
  101: "التوافق مع المكونات الإضافية",
  102: "إذا قمت بتثبيت Day Planner Plugin، فإن هذا المكون الإضافي يقوم بإدخال الوقت في بداية نص المهمة، بدلاً من البيانات الوصفية. بعد تمكين هذه الميزة، سيتم عرض الوقت وفقًا لمكون Day Planner الإضافي داخل ملفات Markdown، ولكن في لوحة المهام، سيتم عرض الوقت في تذييل المهمة.",
  104: "تنسيق تاريخ الاستحقاق",
  106: "تنسيقات تاريخ الاستحقاق والإنجاز",
  107: "ستظهر المعاينة هنا",
  108: "المكونات الإضافية المتوافقة",
  109: "تختلف تنسيقات المكونات الإضافية المختلفة لتعيين علامتي الاستحقاق والإكمال في المهمة. يُرجى تحديد أحد التنسيقات والاطلاع على التنسيق أعلاه، إذا كان متوافقًا مع إعدادك الحالي.",
  110: "تقصير",
  111: "نمط تاريخ ووقت إكمال المهمة",
  112: "أدخل نمط التاريخ والوقت الذي ترغب في رؤيته لقيمة الإكمال. على سبيل المثال yyyy-MM-ddTHH:mm:ss",
  113: "اليوم الأول من الأسبوع",
  114: "حدد اليوم الأول من الأسبوع",
  115: "الأحد",
  116: "الاثنين",
  117: "يوم الثلاثاء",
  118: "الأربعاء",
  119: "يوم الخميس",
  120: "جمعة",
  121: "السبت",
  122: "إتمام المهمة بالتوقيت المحلي",
  123: "ما إذا كانت أوقات إكمال المهام تظهر بالتوقيت المحلي",
  124: "إظهار إزاحة UTC لإكمال المهمة",
  125: "ما إذا كان سيتم عرض إزاحة UTC لأوقات إكمال المهمة",
  126: "إذا أعجبك هذا البرنامج المساعد، ففكر في دعم عملي من خلال تقديم تبرع صغير لتحسين الفكرة بشكل أفضل ومستمر!",
  127: "لغة البرنامج الإضافي",
  128: "حدد لغة واجهة المستخدم للمكون الإضافي. للمساهمة في تحسين اللغة الحالية أو إضافة لغتك الأم، يرجى الرجوع إلى المستندات.",
  129: "هل أنت متأكد أنك تريد حذف هذه اللوحة؟ يمكنك بسهولة إنشائها مرة أخرى إذا كنت تتذكر التكوين.",
  130: "لوحة المهام",
  131: "إضافة مهمة جديدة في الملف الحالي",
  132: "لوحة المهام المفتوحة",
  133: "فتح لوحة المهام في نافذة جديدة",
  134: "تحديث المهام من هذا الملف",
  135: "أضف ملفًا إلى الفلتر ",
  136: "إضافة ملف في الفلتر ",
  137: "إضافة مجلد في الفلتر ",
  138: "إضافة مجلد في الفلتر ",
  139: "مرشحات اللوحة",
  140: "الملفات",
  141: "المجلدات",
  142: "العلامات",
  143: "المكون الإضافي",
  144: "محلي",
  145: "زر تكوين اللوحة",
  146: "زر تحديث اللوحة",
  147: "لا يوجد محرر نشط مفتوح. يرجى وضع المؤشر داخل المحرر وتشغيل هذا الأمر.",
};
export default ar;