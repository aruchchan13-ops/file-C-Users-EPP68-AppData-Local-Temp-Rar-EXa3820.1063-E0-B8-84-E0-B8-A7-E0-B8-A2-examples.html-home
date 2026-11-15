/** The five original primary areas stay first-class in every layout. */
export const PRIMARY_NAV = [
  { to: '/', label: 'สถานะ', full: 'สถานะวันนี้', en: 'Home Status', icon: 'home' },
  { to: '/training', label: 'การฝึก', full: 'การฝึกและการวัด', en: 'Training', icon: 'training' },
  { to: '/symptoms', label: 'อาการ', full: 'บันทึกอาการ', en: 'Symptom Log', icon: 'symptoms' },
  { to: '/trend', label: 'แนวโน้ม', full: 'แนวโน้มภารกิจ', en: 'Mission Trend', icon: 'trend' },
  { to: '/surgeon', label: 'สรุปแพทย์', full: 'สรุปสำหรับแพทย์', en: 'Flight Surgeon', icon: 'surgeon' },
] as const;

export const SECONDARY_NAV = [
  { to: '/training/plan', label: 'แผนฝึกประจำวัน', en: 'Daily Plan', icon: 'plan' },
  { to: '/countermeasures', label: 'มาตรการป้องกัน', en: 'Countermeasures', icon: 'shield' },
  { to: '/measurements', label: 'ประวัติการวัด', en: 'Measurement history', icon: 'list' },
  { to: '/training/lessons', label: 'บทเรียนสั้น', en: 'Micro-learning', icon: 'book' },
  { to: '/about', label: 'เกี่ยวกับและข้อจำกัด', en: 'About & Limitations', icon: 'info' },
  { to: '/settings', label: 'ตั้งค่า', en: 'Settings', icon: 'settings' },
] as const;
