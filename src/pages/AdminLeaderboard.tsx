import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, Calendar, TrendingUp, Award, Crown, Medal, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getLeaderboardService, type LeaderboardEntry, type MonthlyWinner } from "@/services/leaderboardService";

export default function AdminLeaderboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentLeaderboard, setCurrentLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [monthlyWinners, setMonthlyWinners] = useState<MonthlyWinner[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const service = getLeaderboardService();

    try {
      // Salvar snapshot do mês atual
      await service.saveMonthlySnapshot();

      const [current, winners, months] = await Promise.all([
        service.getCurrentLeaderboard(),
        service.getMonthlyWinners(),
        service.getAvailableMonths()
      ]);

      setCurrentLeaderboard(current);
      setMonthlyWinners(winners);
      setAvailableMonths(months);
      if (months.length > 0) {
        setSelectedMonth(months[0]);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Award className="h-6 w-6 text-amber-600" />;
      default:
        return <span className="text-muted-foreground">#{rank}</span>;
    }
  };

  const formatTime = (minutes: number | null) => {
    if (!minutes) return 'N/A';
    if (minutes < 1) return `${Math.round(minutes * 60)}s`;
    if (minutes < 60) return `${Math.round(minutes)}min`;
    return `${Math.round(minutes / 60)}h ${Math.round(minutes % 60)}min`;
  };

  const service = getLeaderboardService();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-primary" />
            Leaderboard
          </h1>
          <p className="text-muted-foreground">Rankings e conquistas mensais dos admins</p>
        </div>
      </div>
      <div className="flex justify-end items-center">
        <Button onClick={loadData} variant="outline">
          <TrendingUp className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="current" className="space-y-4">
        <TabsList>
          <TabsTrigger value="current">
            <Trophy className="h-4 w-4 mr-2" />
            Mês Atual
          </TabsTrigger>
          <TabsTrigger value="history">
            <Calendar className="h-4 w-4 mr-2" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-4">
          {/* Pódio - Top 3 */}
          {currentLeaderboard.length >= 3 && (
            <div className="grid gap-4 md:grid-cols-3">
              {/* 2º Lugar */}
              <Card className="md:order-1">
                <CardHeader className="text-center space-y-2">
                  <div className="flex justify-center">
                    <Medal className="h-12 w-12 text-gray-400" />
                  </div>
                  <Badge variant="secondary" className="mx-auto">2º Lugar</Badge>
                  <CardTitle className="text-lg">{currentLeaderboard[1]?.admin_name}</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-2">
                  <p className="text-3xl font-bold">{currentLeaderboard[1]?.score}</p>
                  <p className="text-sm text-muted-foreground">pontos</p>
                  <Badge variant="outline">Level {currentLeaderboard[1]?.level}</Badge>
                </CardContent>
              </Card>

              {/* 1º Lugar */}
              <Card className="md:order-2 border-primary shadow-lg">
                <CardHeader className="text-center space-y-2">
                  <div className="flex justify-center">
                    <Crown className="h-16 w-16 text-yellow-500" />
                  </div>
                  <Badge className="mx-auto bg-gradient-to-r from-yellow-500 to-orange-500">
                    🏆 Campeão
                  </Badge>
                  <CardTitle className="text-xl">{currentLeaderboard[0]?.admin_name}</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-2">
                  <p className="text-4xl font-bold text-primary">{currentLeaderboard[0]?.score}</p>
                  <p className="text-sm text-muted-foreground">pontos</p>
                  <Badge variant="default">Level {currentLeaderboard[0]?.level}</Badge>
                </CardContent>
              </Card>

              {/* 3º Lugar */}
              <Card className="md:order-3">
                <CardHeader className="text-center space-y-2">
                  <div className="flex justify-center">
                    <Award className="h-12 w-12 text-amber-600" />
                  </div>
                  <Badge variant="outline" className="mx-auto">3º Lugar</Badge>
                  <CardTitle className="text-lg">{currentLeaderboard[2]?.admin_name}</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-2">
                  <p className="text-3xl font-bold">{currentLeaderboard[2]?.score}</p>
                  <p className="text-sm text-muted-foreground">pontos</p>
                  <Badge variant="outline">Level {currentLeaderboard[2]?.level}</Badge>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabela completa */}
          <Card>
            <CardHeader>
              <CardTitle>Ranking Completo - {service.formatMonthYear(new Date().toISOString().slice(0, 7))}</CardTitle>
              <CardDescription>Classificação geral de todos os admins</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Posição</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Level</TableHead>
                    <TableHead className="text-right">Alertas</TableHead>
                    <TableHead className="text-right">Taxa Conf.</TableHead>
                    <TableHead className="text-right">Tempo Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentLeaderboard.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getRankIcon(entry.rank)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{entry.admin_name}</div>
                          <div className="text-sm text-muted-foreground">{entry.admin_phone}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold">{entry.score}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{entry.level}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{entry.total_alerts}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={entry.confirmation_rate >= 85 ? "default" : "secondary"}>
                          {entry.confirmation_rate}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTime(entry.avg_response_time_minutes)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Histórico de Campeões</CardTitle>
                  <CardDescription>Vencedores mensais ao longo do tempo</CardDescription>
                </div>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((month) => (
                      <SelectItem key={month} value={month}>
                        {service.formatMonthYear(month)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {monthlyWinners.map((winner) => (
                <div key={winner.month_year} className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {service.formatMonthYear(winner.month_year)}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-3">
                    {winner.winners.map((entry) => (
                      <Card key={entry.id} className={entry.rank === 1 ? 'border-primary' : ''}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{entry.admin_name}</CardTitle>
                            {getRankIcon(entry.rank)}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Score:</span>
                              <span className="font-bold">{entry.score}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Level:</span>
                              <Badge variant="outline" className="text-xs">{entry.level}</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Alertas:</span>
                              <span>{entry.total_alerts}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
