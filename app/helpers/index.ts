import formatDate from "intl-dateformat";
import { slugify } from "transliteration/dist/browser/bundle.esm.min.js";

const modifiers = {
  replace: {
    ш: "s",
    đ: "dj",
    џ: "dz",
    ћ: "c",
    ч: "c",
    ж: "z",
    š: "s",
    dj: "dj",
    dž: "dz",
    ć: "c",
    č: "c",
    ž: "z",
  },
};

export const months = {
  1: "January",
  2: "February",
  3: "March",
  4: "April",
  5: "May",
  6: "June",
  7: "July",
  8: "August",
  9: "September",
  10: "October",
  11: "November",
  12: "December",
};

export const monthNameToNumber = (name: string): number | null => {
  const entry = Object.entries(months).find(
    ([, m]) => m.toLowerCase() === name.toLowerCase(),
  );
  return entry ? parseInt(entry[0]) : null;
};

export const CONFIG = {
  limit: process.env.DEV ? 12 : 100,
  maxFiles: 10,
  fileSize: 4194304,
  fileType: ".jpg, .jpeg, .png, .gif",
  loginDays: 60,
  //   notifyUrl: process.env.DEV
  //     ? 'http://localhost:5001/andrejevici/us-central1/notify'
  //     : 'https://notify-hq2yjfmwca-uc.a.run.app',
  storageBucket: "andrejevici.appspot.com",
  thumbnails: "thumbnails",
  photo_filter: ["year", "month", "tags", "model", "lens", "email", "nick"],
  adminMap: new Map<string, string>()
    .set("milan.andrejevic@gmail.com", "FvlXe9WUkgaaRQ2tn7nNDiKfjSu1")
    .set("mihailo.genije@gmail.com", "HG9VdF9syLNxHYbdQcU7kspLZ9H2"),
  familyMap: new Map<string, string>()
    .set("milan.andrejevic@gmail.com", "milan") // email.match(/[^.@]+/)
    .set("mihailo.genije@gmail.com", "mihailo")
    .set("ana.devic@gmail.com", "ana")
    .set("dannytaboo@gmail.com", "dannytaboo")
    .set("svetlana.andrejevic@gmail.com", "svetlana")
    .set("011.nina@gmail.com", "011")
    .set("djordjeandrejevic13@gmail.com", "djordje")
    .set("bogdan.andrejevic16@gmail.com", "bogdan")
    .set("zile.zikson@gmail.com", "zile"),

  dateFormat: "YYYY-MM-DD HH:mm",
  cache_control: "public, max-age=604800",
  noTitle: "No name",
  fileBroken: "/broken_image.svg",
  title: "ANDрејевићи",
  description: "ANDрејевићи photo album",
};

export const formatDatum = (str: Date | number | string): string => {
  const date = new Date(str);
  return formatDate(date, CONFIG.dateFormat);
};

export const reFilename = /^([^/]+)\.[^/]+$/;

export const thumbName = (filename: string) => {
  const match = filename.match(reFilename);
  if (!match) return "";
  const [, name] = match;
  return [CONFIG.thumbnails, name + "_400x400.jpeg"].join("/");
};

export const sliceSlug = (text: string): string[] => {
  const slug = slugify(text, modifiers);
  const result: string[] = [];
  for (const word of slug.split("-")) {
    for (let j = 3; j < word.length + 1; j++) {
      const part = word.slice(0, j);
      if (part.length > 8) break;
      result.push(part);
    }
  }
  return result;
};

export const delimiter = "||"; // for counter id

export const counterId = (field: string, value: string): string => {
  return `Photo${delimiter}${field}${delimiter}${value}`; // FIXME Photo is hard coded
};

export const version = () => {
  const ts = process.env.NEXT_PUBLIC_BUILD_ID || "";
  const date = new Date(+ts);
  return formatDate(date, CONFIG.dateFormat);
};
