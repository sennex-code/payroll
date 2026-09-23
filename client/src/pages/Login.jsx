import { useState } from "react";
import axiosInterceptor from "../hooks/interceptor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Eye, EyeOff } from "lucide-react";

const STORAGE_TOKEN_KEY = "wah_token";
const STORAGE_USER_KEY = "wah_user";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLocalLogin = (token, nextUser) => {
    localStorage.setItem(STORAGE_TOKEN_KEY, token);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(nextUser));
  };

  const login = useMutation({
    mutationFn: async ({ username, password }) => {
      const res = await axios.post("http://localhost:8000/api/auth/login", {
        username,
        password,
      });
      const data = res.data;
      handleLocalLogin(data.token, data.user);
      window.location.href =
        data.user.role === "HR" ? "/hr-dashboard" : "/dashboard";
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3d0d74] via-[#50109a] to-[#6c2eb9] p-4 md:p-8">
      {}
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl grid-cols-1 overflow-hidden rounded-2xl border border-white/20 bg-white/95 shadow-2xl md:h-[calc(100vh-4rem)] md:grid-cols-2">
        <section className="relative hidden md:flex flex-col justify-between overflow-hidden bg-[#4a148c] p-10 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.16),transparent_35%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.10),transparent_30%)]" />

          {}
          <div className="relative shrink-0">
            <div className="mb-10 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                <img
                  src="/images/wah-logo.png"
                  alt="WAH logo"
                  className="h-9 w-9 object-contain"
                />
              </div>
              <div>
                <p className="m-0 text-xs uppercase tracking-[0.22em] text-white/70">
                  WAH Payroll
                </p>
                <h2 className="m-0 text-lg font-semibold text-white">
                  Wireless Access For Health
                </h2>
              </div>
            </div>

            <h1 className="m-0 max-w-md text-4xl font-bold leading-tight">
              Professional workforce and payroll management.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-white/80">
              Securely manage employee records, attendance, leave, and payroll
              in one classic internal platform.
            </p>
          </div>

          {}
          <div className="relative flex-1 min-h-0 flex items-center justify-center my-1 px-0">
            <img
              src="/images/JuWaH.png"
              alt="WAH Illustration"
              className="h-full w-full object-contain drop-shadow-2xl"
            />
          </div>

          {}
          <p className="relative shrink-0 m-0 text-xs uppercase tracking-[0.18em] text-white/60">
            Internal Access Only
          </p>
        </section>

        {}
        <section className="flex items-center justify-center overflow-y-auto bg-white p-6 md:p-10">
          <Card className="w-full max-w-md border border-slate-200 shadow-none">
            <CardHeader className="space-y-2 pb-4">
              <CardTitle className="text-2xl font-semibold text-slate-900">
                Sign in
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Enter your account credentials to continue.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  login.mutate({ username, password });
                }}
              >
                <FieldGroup className="space-y-5">
                  <Field className="space-y-2">
                    <FieldLabel
                      htmlFor="username"
                      className="text-sm font-medium text-slate-700"
                    >
                      Username
                    </FieldLabel>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter username"
                      value={username}
                      onChange={(e) =>
                        setUsername(e.target.value.replace(/\s+/g, ""))
                      }
                      required
                      className="h-11 rounded-lg border-slate-300 bg-white"
                    />
                  </Field>

                  <Field className="space-y-2">
                    <FieldLabel
                      htmlFor="password"
                      className="text-sm font-medium text-slate-700"
                    >
                      Password
                    </FieldLabel>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="h-11 w-full rounded-lg border-slate-300 bg-white pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5" />
                        ) : (
                          <Eye className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </Field>

                  {login.error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {login.error?.response?.data?.message ||
                        login.error?.message ||
                        "Invalid username or password."}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={login.isPending}
                    className="h-11 w-full rounded-lg bg-[#5a1ea2] text-sm font-semibold text-white hover:bg-[#4b1788]"
                  >
                    {login.isPending ? "Signing in..." : "Sign in"}
                  </Button>

                  <Separator />
                  <p className="m-0 text-center text-xs text-slate-500">
                    Protected system access for authorized WAH personnel.
                  </p>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
