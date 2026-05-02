"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function Header() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const toggleLocale = () => {
    const next = locale === "ja" ? "en" : "ja";
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-start gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
        <h1 className="text-lg font-bold text-gray-900">
          SPReAD-1000 Advisor
        </h1>
        <nav className="flex items-center gap-4">
          <a href="/" className="text-sm text-gray-600 hover:text-gray-900">
            {t("home")}
          </a>
          <a href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
            {t("settings")}
          </a>
          <button
            type="button"
            onClick={toggleLocale}
            disabled={isPending}
            className="rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {locale === "ja" ? "EN" : "JA"}
          </button>
        </nav>
      </div>
    </header>
  );
}
