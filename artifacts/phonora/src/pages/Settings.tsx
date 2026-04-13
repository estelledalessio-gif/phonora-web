import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUpdateProfile, useGetSettings, useUpdateSettings, getGetProfileQueryKey, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const profileSchema = z.object({
  displayName: z.string().min(2, "Name is required"),
  nativeLanguage: z.string().optional(),
  targetAccent: z.string().optional(),
});

const settingsSchema = z.object({
  theme: z.string(),
  showPhonemeBreakdown: z.boolean(),
  dailyGoalMinutes: z.number().min(1).max(120),
});

export default function Settings() {
  const { user } = useAuth();
  const { data: settings } = useGetSettings();
  const { toast } = useToast();
  const { setTheme } = useTheme();
  const queryClient = useQueryClient();

  const updateProfileMutation = useUpdateProfile();
  const updateSettingsMutation = useUpdateSettings();

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: "",
      nativeLanguage: "",
      targetAccent: "American English",
    },
  });

  const settingsForm = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      theme: "light",
      showPhonemeBreakdown: true,
      dailyGoalMinutes: 15,
    },
  });

  // Initialize forms when data loads
  useEffect(() => {
    if (user) {
      profileForm.reset({
        displayName: user.displayName || "",
        nativeLanguage: user.nativeLanguage || "",
        targetAccent: user.targetAccent || "American English",
      });
    }
  }, [user, profileForm]);

  useEffect(() => {
    if (settings) {
      settingsForm.reset({
        theme: settings.theme,
        showPhonemeBreakdown: settings.showPhonemeBreakdown,
        dailyGoalMinutes: settings.dailyGoalMinutes,
      });
    }
  }, [settings, settingsForm]);

  const onProfileSubmit = async (values: z.infer<typeof profileSchema>) => {
    try {
      await updateProfileMutation.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      toast({ title: "Profile updated", description: "Your profile changes have been saved." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
    }
  };

  const onSettingsSubmit = async (values: z.infer<typeof settingsSchema>) => {
    try {
      await updateSettingsMutation.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
      if (values.theme === "dark" || values.theme === "light") {
        setTheme(values.theme);
      }
      toast({ title: "Settings updated", description: "Your preferences have been saved." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update settings.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8 pb-10 max-w-2xl mx-auto">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your account profile and app preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear in Phonora</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
              <FormField
                control={profileForm.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid md:grid-cols-2 gap-6">
                <FormField
                  control={profileForm.control}
                  name="nativeLanguage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Native Language</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Spanish, Mandarin" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormDescription>Helps tailor feedback</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="targetAccent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Accent</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select accent" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="American English">American English</SelectItem>
                          <SelectItem value="British English">British English</SelectItem>
                          <SelectItem value="Australian English">Australian English</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Profile
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>Customize your learning experience</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...settingsForm}>
            <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
              <FormField
                control={settingsForm.control}
                name="theme"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Theme</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="w-full md:w-[240px]">
                          <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="light">Light (Cream)</SelectItem>
                        <SelectItem value="dark">Dark (Navy)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={settingsForm.control}
                name="dailyGoalMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Daily Goal (Minutes)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10))} 
                        className="w-full md:w-[240px]"
                      />
                    </FormControl>
                    <FormDescription>We recommend at least 15 minutes a day</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={settingsForm.control}
                name="showPhonemeBreakdown"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/20">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Show Phoneme Breakdown</FormLabel>
                      <FormDescription>
                        Display detailed IPA translation when practicing
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={updateSettingsMutation.isPending}>
                {updateSettingsMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Preferences
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}