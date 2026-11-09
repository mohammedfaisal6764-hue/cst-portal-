// ক্লাস রুটিন — Semester 4, Section (Group) B
// slot: [period(1-7), কত period জুড়ে, বিষয়-key, রুম, শিক্ষক, lab?]
export const ROUTINE_META = {
  title: 'Semester 4 Class Routine',
  place: 'Institute of Computer Science & Technology, Sadar Hospital Road, Feni · Technology: Computer Science · 2026',
  semester: 'Semester 4', section: 'B', code: '69016',
}

export const R_SUBJECTS = {
  BC: ['Business Communication',            '25831', '#e0457b'],
  DE: ['Digital Electronics 2',             '26841', '#7b5cf0'],
  JV: ['Java Programming',                  '28541', '#e8730c'],
  DS: ['Data Structure & Algorithm',        '28542', '#0a8f6a'],
  CP: ['Computer Peripherals & Interfacing','28543', '#1c7ed6'],
  WD: ['Web Design & Development 1',        '28544', '#c2a000'],
  ES: ['Environmental Studies',             '29041', '#4c9a2a'],
}

// শনি–বৃহস্পতি (শুক্রবার বন্ধ)
export const R_DAYS = [
  ['Saturday',  'শনিবার'], ['Sunday', 'রবিবার'], ['Monday', 'সোমবার'],
  ['Tuesday',   'মঙ্গলবার'], ['Wednesday', 'বুধবার'], ['Thursday', 'বৃহস্পতিবার'],
]

export const R_TIMES = ['08:00', '08:45', '09:30', '10:15', '11:00', '11:45', '12:30', '01:15']

export const R_SLOTS = {
  Saturday:  [[3,2,'JV','SWL-1','SSL',1],[5,1,'DS','R-306','Arafat'],[6,1,'CP','R-306','IH'],[7,1,'WD','R-306','SSL']],
  Sunday:    [[3,2,'DS','SWL-2','Arafat',1],[5,1,'DE','R-306','OC'],[6,1,'ES','R-306','AAE'],[7,1,'JV','R-306','SSL']],
  Monday:    [[1,1,'CP','R-305','IH'],[2,1,'BC','R-305','SS'],[3,2,'CP','SWL-3','IH',1],[5,1,'JV','R-306','SSL'],[6,1,'DE','R-306','OC']],
  Tuesday:   [[1,2,'WD','SWL-1','SSL',1],[3,1,'DS','R-307','Arafat'],[4,1,'BC','R-307','SS'],[5,2,'ES','PHY LAB-504','AAE',1]],
  Wednesday: [[2,1,'CP','R-506','IH'],[3,1,'DE','R-506','OC'],[4,1,'ES','R-506','AAE'],[5,2,'WD','SWL-1','SSL',1]],
  Thursday:  [[1,1,'DS','R-306','Arafat'],[2,1,'ES','R-306','AAE'],[3,2,'DE','ENT LAB-408','OC',1],[5,1,'JV','R-307','SSL'],[6,1,'BC','R-307','SS']],
}
