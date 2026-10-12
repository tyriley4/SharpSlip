const GRADE_COLOR: Record<string, 'grade-a' | 'grade-b' | 'grade-c'> = {
  'A+': 'grade-a',
  A: 'grade-a',
  'A-': 'grade-a',
  'B+': 'grade-b',
  B: 'grade-b',
  'B-': 'grade-c',
  C: 'grade-c',
}

const COLOR_CLASS: Record<'grade-a' | 'grade-b' | 'grade-c', string> = {
  'grade-a': 'border-grade-a/40 bg-grade-a/[0.12] text-grade-a',
  'grade-b': 'border-grade-b/40 bg-grade-b/[0.12] text-grade-b',
  'grade-c': 'border-grade-c/40 bg-grade-c/[0.12] text-grade-c',
}

export function GradeChip({ grade }: { grade: string }) {
  const color = GRADE_COLOR[grade] ?? 'grade-c'
  return (
    <div
      className={`flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-[12px] font-extrabold ${COLOR_CLASS[color]}`}
    >
      {grade}
    </div>
  )
}
