import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon } from "lucide-react";
import { de } from "@/lib/i18n/de";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {de.settings.title}
      </h1>
      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">{de.settings.company}</TabsTrigger>
          <TabsTrigger value="integrations">
            {de.settings.integrations}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {de.settings.companySettings}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {de.settings.comingSoon}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="integrations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {de.settings.integrationSettings}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center py-8">
              <SettingsIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-sm text-muted-foreground">
                {de.settings.comingSoon}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
