import { cookies } from "next/headers";
import { dictionaries } from "./dictionaries";

export async function getDictionary() {
  const cookieStore = await cookies();
  const lang = cookieStore.get("app_lang")?.value || "vi";
  return dictionaries[lang as keyof typeof dictionaries] || dictionaries.vi;
}
