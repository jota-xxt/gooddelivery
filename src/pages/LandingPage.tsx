import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import {
  Zap,
  DollarSign,
  Clock,
  Shield,
  Smartphone,
  TrendingUp,
  ChevronRight,
  MapPin,
  CheckCircle2,
  Star,
  Users,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import heroDriver from "@/assets/hero-driver.png";
import logo from "@/assets/logo.png";

const benefits = [
  {
    icon: DollarSign,
    title: "Ganhos Competitivos",
    description: "Receba por cada entrega com taxas justas e transparentes. Sem surpresas.",
  },
  {
    icon: Clock,
    title: "Horário Flexível",
    description: "Trabalhe quando quiser. Você decide seus horários e sua rotina.",
  },
  {
    icon: Zap,
    title: "Receba Rápido",
    description: "Pagamentos semanais direto na sua conta. Sem burocracia.",
  },
  {
    icon: Shield,
    title: "Suporte Dedicado",
    description: "Equipe pronta para te ajudar a qualquer momento via chat.",
  },
  {
    icon: Smartphone,
    title: "App Intuitivo",
    description: "Aplicativo fácil de usar com notificações em tempo real.",
  },
  {
    icon: TrendingUp,
    title: "Cresça Conosco",
    description: "Quanto mais entregas, mais você ganha. Sistema de ranking e bonificações.",
  },
];

const steps = [
  {
    number: "01",
    title: "Cadastre-se",
    description: "Preencha seus dados e envie os documentos necessários em poucos minutos.",
  },
  {
    number: "02",
    title: "Aprovação Rápida",
    description: "Nossa equipe analisa seu cadastro e você é aprovado rapidamente.",
  },
  {
    number: "03",
    title: "Comece a Entregar",
    description: "Fique online, receba pedidos e comece a faturar!",
  },
];

const faqs = [
  {
    question: "Preciso ter moto própria?",
    answer: "Sim, é necessário ter seu próprio veículo (moto, bicicleta ou carro) para realizar as entregas.",
  },
  {
    question: "Quanto posso ganhar por mês?",
    answer: "Seus ganhos dependem da quantidade de entregas realizadas. Entregadores ativos faturam em média R$ 3.000 a R$ 5.000 por mês.",
  },
  {
    question: "Como recebo meus pagamentos?",
    answer: "Os pagamentos são feitos semanalmente via transferência bancária, com relatório detalhado de todas as entregas.",
  },
  {
    question: "Posso escolher meus horários?",
    answer: "Sim! Você tem total liberdade para decidir quando e quanto quer trabalhar. Basta ficar online no app.",
  },
  {
    question: "Quais documentos preciso?",
    answer: "CPF, CNH (para moto/carro), comprovante de residência e foto do veículo. O processo é 100% digital.",
  },
];

const stats = [
  { value: "500+", label: "Entregadores ativos" },
  { value: "50k+", label: "Entregas realizadas" },
  { value: "R$ 8,50", label: "Valor médio por entrega" },
  { value: "4.8★", label: "Avaliação do app" },
];

const LandingPage = () => {
  const navigate = useNavigate();
  const { user, role, status, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && status === "approved") {
      if (role === "admin") navigate("/admin", { replace: true });
      else if (role === "driver") navigate("/driver", { replace: true });
      else if (role === "establishment") navigate("/establishment", { replace: true });
    }
  }, [user, role, status, loading, navigate]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <img src={logo} alt="Good Delivery" className="h-8 object-contain" />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button size="sm" onClick={() => navigate("/register")}>
              Cadastrar
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
        <div className="max-w-6xl mx-auto px-4 pt-12 pb-8 md:pt-20 md:pb-16 relative">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-semibold">
                <Zap className="h-4 w-4" />
                Vagas Abertas
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight">
                Ganhe dinheiro{" "}
                <span className="text-primary">entregando</span> no seu tempo
              </h1>
              <p className="text-lg text-muted-foreground max-w-md">
                Seja seu próprio chefe. Cadastre-se na Good Delivery e comece a
                faturar hoje mesmo com entregas na sua cidade.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="text-base gap-2 shadow-lg shadow-primary/25"
                  onClick={() => navigate("/register")}
                >
                  Quero ser entregador
                  <ArrowRight className="h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base"
                  onClick={() => {
                    document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Como funciona?
                </Button>
              </div>
            </div>
            <div className="flex justify-center">
              <img
                src={heroDriver}
                alt="Entregador Good Delivery"
                className="w-80 md:w-96 drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-primary text-primary-foreground py-8">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl md:text-4xl font-extrabold">{stat.value}</div>
              <div className="text-sm opacity-90 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Por que ser um <span className="text-primary">Good Driver</span>?
            </h2>
            <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
              Vantagens exclusivas que fazem a diferença no seu dia a dia
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b) => (
              <Card
                key={b.title}
                className="group hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 border-border hover:border-primary/30"
              >
                <CardContent className="p-6 flex gap-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <b.icon className="h-6 w-6 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">{b.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{b.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-16 md:py-24 bg-muted/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Como <span className="text-primary">funciona</span>?
            </h2>
            <p className="mt-3 text-muted-foreground">3 passos simples para começar a faturar</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.number} className="relative text-center">
                <div className="inline-flex h-16 w-16 rounded-2xl bg-primary text-primary-foreground items-center justify-center text-2xl font-extrabold mb-4 shadow-lg shadow-primary/30">
                  {step.number}
                </div>
                {i < steps.length - 1 && (
                  <ChevronRight className="hidden md:block absolute top-6 -right-4 h-8 w-8 text-primary/40" />
                )}
                <h3 className="text-xl font-bold text-foreground">{step.title}</h3>
                <p className="text-muted-foreground mt-2 max-w-xs mx-auto">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Earnings simulation */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-8 md:p-12 text-primary-foreground">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <h2 className="text-3xl md:text-4xl font-bold">
                  Simule seus ganhos
                </h2>
                <p className="opacity-90">
                  Fazendo em média <strong>10 entregas por dia</strong>, 5 dias
                  por semana:
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                    <span>~R$ 85/dia em entregas</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                    <span>~R$ 425/semana</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                    <span className="text-xl font-bold">~R$ 1.700 a R$ 4.250/mês</span>
                  </div>
                </div>
                <p className="text-xs opacity-75">
                  *Valores estimados. Ganhos reais dependem da região, horários e
                  demanda.
                </p>
              </div>
              <div className="flex justify-center">
                <div className="bg-primary-foreground/10 backdrop-blur rounded-2xl p-6 space-y-4 w-full max-w-xs">
                  <div className="text-center">
                    <DollarSign className="h-10 w-10 mx-auto mb-2 opacity-90" />
                    <div className="text-5xl font-extrabold">R$ 4.250</div>
                    <div className="text-sm opacity-80 mt-1">potencial mensal</div>
                  </div>
                  <Button
                    size="lg"
                    className="w-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold"
                    onClick={() => navigate("/register")}
                  >
                    Começar Agora
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-24 bg-muted/50">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Perguntas <span className="text-primary">Frequentes</span>
            </h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group bg-card rounded-xl border border-border overflow-hidden"
              >
                <summary className="flex items-center justify-between p-5 cursor-pointer font-semibold text-foreground hover:text-primary transition-colors">
                  {faq.question}
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-open:rotate-90 transition-transform" />
                </summary>
                <div className="px-5 pb-5 text-muted-foreground text-sm">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 md:py-24">
        <div className="max-w-3xl mx-auto px-4 text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Pronto para <span className="text-primary">começar</span>?
          </h2>
          <p className="text-lg text-muted-foreground">
            Junte-se a centenas de entregadores que já estão faturando com a Good
            Delivery. Cadastro rápido e gratuito.
          </p>
          <Button
            size="lg"
            className="text-lg px-10 gap-2 shadow-lg shadow-primary/25"
            onClick={() => navigate("/register")}
          >
            Criar Minha Conta
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-card">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <img src={logo} alt="Good Delivery" className="h-6 object-contain opacity-70" />
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Good Delivery. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
