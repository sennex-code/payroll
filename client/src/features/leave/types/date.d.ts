type DateDiffInclusive = {
  start: string;
  end: string;
};
type IsInRange = {
  date: string | Date;
  from: string | Date;
  to: string | Date;
};

type DateInput = string | Date | null | undefined;
