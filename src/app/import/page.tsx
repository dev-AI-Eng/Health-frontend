import { FileSpreadsheet, Info } from "lucide-react";

import { ApiFailure, Empty, PageHeading } from "@/components/page";
import { ImportUpload } from "@/components/import-upload";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMappingProfiles } from "@/lib/api-import";
import { upload } from "@/lib/import-actions";
import { translator } from "@/lib/i18n";
import { load } from "@/lib/load";
import { currentLocale } from "@/lib/locale";

/** Rendered per request: the saved profiles change as imports are confirmed. */
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const locale = await currentLocale();
  const t = translator(locale);
  const result = await load("import", (clinic) => listMappingProfiles(clinic.id));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading title={t("import.title")} subtitle={t("import.subtitle")} />

      <ImportUpload
        action={upload}
        labels={{
          drop: t("import.drop"),
          formats: t("import.formats"),
          choose: t("import.choose"),
          reading: t("import.reading"),
        }}
      />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            {t("import.profiles")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Said here because it is the third exit criterion and invisible
              otherwise: the second file of a shape needs no re-mapping. */}
          <p className="text-muted-foreground mb-4 flex items-start gap-2 text-sm">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            {t("import.profilesHint")}
          </p>

          {!result.ok ? (
            <ApiFailure detail={result.spanish} requestId={result.requestId} locale={locale} />
          ) : result.data.length === 0 ? (
            <Empty icon={<FileSpreadsheet className="size-5" />}>
              {t("import.noProfiles")}
            </Empty>
          ) : (
            <ul className="divide-border divide-y">
              {result.data.map((profile) => (
                <li
                  key={profile.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{profile.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {Object.keys(profile.mapping).length} {t("import.col.column")} ·{" "}
                      {profile.entity}
                    </p>
                  </div>
                  <Badge variant="secondary">v{profile.version}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
