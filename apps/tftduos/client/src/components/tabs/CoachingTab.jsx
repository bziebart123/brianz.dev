import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Heading,
  Icon,
  Pane,
  Select,
  Spinner,
  Strong,
  Text,
  TextInput,
  Textarea,
} from "evergreen-ui";
import { DISPLAY_NAME_A, DISPLAY_NAME_B } from "../../config/constants";
import IconWithLabel from "../IconWithLabel";
import MetricBar from "../MetricBar";
import Sparkline from "../Sparkline";
import { asArray, formatTime, prettyName } from "../../utils/tft";

export default function CoachingTab({
  duoRisk,
  decisionGrade,
  leakCount,
  rescueRate,
  clutchIndex,
  filteredMatches,
  placementTrend,
  totalPressureA,
  totalPressureB,
  lowGoldLossA,
  lowGoldLossB,
  lowDamageLossA,
  lowDamageLossB,
  suggestionCards,
  scorecard,
  coachingBranches,
  giftMetrics,
  staggerSuggestions,
  openerCards,
  iconManifest,
  payload,
  coachingInsights,
  highlights,
  coachMatchId,
  setCoachMatchId,
  planAt32,
  setPlanAt32,
  executedPlan,
  setExecutedPlan,
  tagPanicRoll,
  setTagPanicRoll,
  tagMissedGift,
  setTagMissedGift,
  tagBothRoll,
  setTagBothRoll,
  submitJournal,
  duoId,
  coachSaving,
  quickStage,
  setQuickStage,
  quickActor,
  setQuickActor,
  submitQuickEvent,
  coachMessage,
}) {
  return (
    <Pane display="grid" gap={12}>
      <Card elevation={0} padding={16}>
        <Pane display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={10}>
          <Heading size={500}>Interaction Lab</Heading>
          <Badge color={duoRisk >= 65 ? "red" : duoRisk >= 40 ? "yellow" : "green"}>Duo Risk {duoRisk}%</Badge>
        </Pane>

        <Pane marginTop={10} display="grid" gridTemplateColumns="repeat(auto-fit, minmax(180px, 1fr))" gap={10}>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)">
            <Pane display="flex" alignItems="center" gap={8}>
              <Icon icon="endorsed" size={18} />
              <Text size={400} color="muted">Decision Grade</Text>
            </Pane>
            <Heading size={700} marginTop={8}>{decisionGrade}/100</Heading>
          </Card>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)">
            <Pane display="flex" alignItems="center" gap={8}>
              <Icon icon="issue" size={18} />
              <Text size={400} color="muted">Active Leaks</Text>
            </Pane>
            <Heading size={700} marginTop={8}>{leakCount}</Heading>
          </Card>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)">
            <Pane display="flex" alignItems="center" gap={8}>
              <Icon icon="people" size={18} />
              <Text size={400} color="muted">Rescue Rate</Text>
            </Pane>
            <Heading size={700} marginTop={8}>{rescueRate.toFixed(0)}%</Heading>
          </Card>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)">
            <Pane display="flex" alignItems="center" gap={8}>
              <Icon icon="star" size={18} />
              <Text size={400} color="muted">Clutch Index</Text>
            </Pane>
            <Heading size={700} marginTop={8}>{clutchIndex.toFixed(0)}%</Heading>
          </Card>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)">
            <Pane display="flex" alignItems="center" gap={8}>
              <Icon icon="line-chart" size={18} />
              <Text size={400} color="muted">Recent Games</Text>
            </Pane>
            <Heading size={700} marginTop={8}>{filteredMatches.length}</Heading>
          </Card>
        </Pane>

        <Pane marginTop={12} display="grid" gridTemplateColumns="repeat(auto-fit, minmax(280px, 1fr))" gap={10}>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)">
            <Pane display="flex" alignItems="center" gap={8} marginBottom={8}>
              <Icon icon="line-chart" size={16} />
              <Text size={400} color="muted">Team Placement Trend</Text>
            </Pane>
            <Sparkline values={placementTrend} />
          </Card>

          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)">
            <Pane display="flex" alignItems="center" gap={8}>
              <Icon icon="people" size={16} />
              <Text size={400} color="muted">Pressure Map</Text>
            </Pane>
            <Pane marginTop={8} display="grid" gap={8}>
              <Pane padding={8} border="default" borderRadius={6}>
                <Pane display="flex" justifyContent="space-between" alignItems="center">
                  <Text size={400}><Strong>{DISPLAY_NAME_A}</Strong></Text>
                  <Badge color={totalPressureA > totalPressureB ? "red" : "neutral"}>{totalPressureA} signals</Badge>
                </Pane>
                <Pane marginTop={8} display="grid" gap={8}>
                  <MetricBar label="Low-gold losses" value={Math.min(100, lowGoldLossA * 20)} color="orange" />
                  <MetricBar label="Low-damage losses" value={Math.min(100, lowDamageLossA * 20)} color="red" />
                </Pane>
              </Pane>
              <Pane padding={8} border="default" borderRadius={6}>
                <Pane display="flex" justifyContent="space-between" alignItems="center">
                  <Text size={400}><Strong>{DISPLAY_NAME_B}</Strong></Text>
                  <Badge color={totalPressureB > totalPressureA ? "red" : "neutral"}>{totalPressureB} signals</Badge>
                </Pane>
                <Pane marginTop={8} display="grid" gap={8}>
                  <MetricBar label="Low-gold losses" value={Math.min(100, lowGoldLossB * 20)} color="orange" />
                  <MetricBar label="Low-damage losses" value={Math.min(100, lowDamageLossB * 20)} color="red" />
                </Pane>
              </Pane>
            </Pane>
          </Card>
        </Pane>

        <Pane marginTop={12} display="grid" gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap={10}>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)">
            <Pane display="flex" alignItems="center" gap={8}>
              <Icon icon="warning-sign" size={16} />
              <Text size={400} color="muted">Fix Queue</Text>
            </Pane>
            <Pane marginTop={8} display="grid" gap={8}>
              {suggestionCards.length ? (
                suggestionCards.map((item) => (
                  <Pane key={item.id} padding={8} border="default" borderRadius={6}>
                    <Pane display="flex" alignItems="center" gap={8}>
                      <Icon icon={item.icon} size={14} />
                      <Text size={300}><Strong>{item.title}</Strong></Text>
                    </Pane>
                    <Text size={300} color="muted" marginTop={4}>{item.why}</Text>
                    <Text size={300} marginTop={4}>Fix: {item.fix}</Text>
                  </Pane>
                ))
              ) : (
                <Text size={300} color="muted">No leak signals in this filter.</Text>
              )}
            </Pane>
          </Card>

          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)">
            <Pane display="flex" alignItems="center" gap={8}>
              <Icon icon="manual" size={16} />
              <Text size={400} color="muted">AI Action Plan</Text>
            </Pane>
            <Pane marginTop={8} display="grid" gap={8}>
              <Pane display="flex" alignItems="center" gap={8}>
                <Icon icon="time" size={14} />
                <Text size={300}>{scorecard?.coachingReplay?.stage2 || "No Stage 2 guidance yet."}</Text>
              </Pane>
              <Pane display="flex" alignItems="center" gap={8}>
                <Icon icon="time" size={14} />
                <Text size={300}>{scorecard?.coachingReplay?.stage3 || "No Stage 3 guidance yet."}</Text>
              </Pane>
              <Pane display="flex" alignItems="center" gap={8}>
                <Icon icon="time" size={14} />
                <Text size={300}>{scorecard?.coachingReplay?.stage4 || "No Stage 4 guidance yet."}</Text>
              </Pane>
              {coachingBranches.map((line, idx) => (
                <Pane key={`branch-${idx}`} display="flex" alignItems="center" gap={8}>
                  <Icon icon="git-branch" size={14} />
                  <Text size={300}>{line}</Text>
                </Pane>
              ))}
            </Pane>
          </Card>
        </Pane>

        <Pane marginTop={12} display="grid" gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap={10}>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)">
            <Pane display="flex" alignItems="center" gap={8}>
              <Icon icon="widget" size={16} />
              <Text size={400} color="muted">Gift / Econ Coordination</Text>
            </Pane>
            <Pane marginTop={8} display="grid" gap={8}>
              <MetricBar label="Gift ROI" value={giftMetrics.giftROI} color="green" />
              <MetricBar label="Item Gift Rate" value={giftMetrics.itemGiftRate} color="blue" />
              <MetricBar label="Bench Waste Rate" value={giftMetrics.benchWasteRate} color="red" />
              {staggerSuggestions.map((line, idx) => (
                <Pane key={`stagger-${idx}`} display="flex" alignItems="center" gap={8}>
                  <Icon icon="walk" size={14} />
                  <Text size={300}>{line}</Text>
                </Pane>
              ))}
            </Pane>
          </Card>

          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)">
            <Pane display="flex" alignItems="center" gap={8}>
              <Icon icon="cube" size={16} />
              <Text size={400} color="muted">Opener Intelligence</Text>
            </Pane>
            <Pane marginTop={8} display="grid" gap={8}>
              {openerCards.length ? (
                openerCards.map((opener) => (
                  <Pane key={opener.id} padding={8} border="default" borderRadius={6}>
                    <Pane display="flex" alignItems="center" justifyContent="space-between" marginBottom={6}>
                      <Text size={300}><Strong>Patch {opener.patch || "?"}</Strong></Text>
                      <Badge color="neutral">Set {opener.setNumber ?? "?"}</Badge>
                    </Pane>
                    <Pane display="grid" gap={8}>
                      <Pane>
                        <Text size={300} marginBottom={6} display="block">{DISPLAY_NAME_A}</Text>
                        <Pane display="flex" gap={6} flexWrap="wrap">
                          {asArray(opener.playerA).slice(0, 5).map((token) => (
                            <IconWithLabel
                              key={`${opener.id}-a-${token}`}
                              kind="trait"
                              token={token}
                              label={prettyName(token)}
                              size={42}
                              iconManifest={iconManifest}
                            />
                          ))}
                        </Pane>
                      </Pane>
                      <Pane>
                        <Text size={300} marginBottom={6} display="block">{DISPLAY_NAME_B}</Text>
                        <Pane display="flex" gap={6} flexWrap="wrap">
                          {asArray(opener.playerB).slice(0, 5).map((token) => (
                            <IconWithLabel
                              key={`${opener.id}-b-${token}`}
                              kind="trait"
                              token={token}
                              label={prettyName(token)}
                              size={42}
                              iconManifest={iconManifest}
                            />
                          ))}
                        </Pane>
                      </Pane>
                    </Pane>
                  </Pane>
                ))
              ) : (
                <Text size={300} color="muted">No opener patterns yet.</Text>
              )}
            </Pane>
          </Card>
        </Pane>

        <Pane marginTop={12} display="grid" gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap={10}>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)">
            <Pane display="flex" alignItems="center" gap={8}>
              <Icon icon="clean" size={16} />
              <Text size={400} color="muted">{DISPLAY_NAME_A} Profile</Text>
            </Pane>
            <Pane marginTop={8} display="grid" gap={8}>
              <Pane display="flex" alignItems="center" gap={8}>
                <Icon icon="person" size={14} />
                <Text size={300}>Tactician: {payload.players?.a?.tactician?.species || "Unavailable"}</Text>
              </Pane>
              <Pane display="flex" alignItems="center" gap={8}>
                <Icon icon="media" size={14} />
                <Text size={300}>Arena: {payload.players?.a?.arena?.available ? payload.players?.a?.arena?.source || "Detected" : "Unavailable"}</Text>
              </Pane>
              <Pane display="flex" flexWrap="wrap" gap={8}>
                {coachingInsights.topItemsA.length ? (
                  coachingInsights.topItemsA.map(([name, count]) => (
                    <Badge key={`item-a-${name}`} color="neutral">{prettyName(name)} x{count}</Badge>
                  ))
                ) : (
                  <Text size={300} color="muted">No item data in current filter.</Text>
                )}
              </Pane>
            </Pane>
          </Card>
          <Card elevation={0} padding={12} background="rgba(255,255,255,0.03)">
            <Pane display="flex" alignItems="center" gap={8}>
              <Icon icon="clean" size={16} />
              <Text size={400} color="muted">{DISPLAY_NAME_B} Profile</Text>
            </Pane>
            <Pane marginTop={8} display="grid" gap={8}>
              <Pane display="flex" alignItems="center" gap={8}>
                <Icon icon="person" size={14} />
                <Text size={300}>Tactician: {payload.players?.b?.tactician?.species || "Unavailable"}</Text>
              </Pane>
              <Pane display="flex" alignItems="center" gap={8}>
                <Icon icon="media" size={14} />
                <Text size={300}>Arena: {payload.players?.b?.arena?.available ? payload.players?.b?.arena?.source || "Detected" : "Unavailable"}</Text>
              </Pane>
              <Pane display="flex" flexWrap="wrap" gap={8}>
                {coachingInsights.topItemsB.length ? (
                  coachingInsights.topItemsB.map(([name, count]) => (
                    <Badge key={`item-b-${name}`} color="neutral">{prettyName(name)} x{count}</Badge>
                  ))
                ) : (
                  <Text size={300} color="muted">No item data in current filter.</Text>
                )}
              </Pane>
            </Pane>
          </Card>
        </Pane>

        {highlights.length ? (
          <Card elevation={0} padding={12} marginTop={12} background="rgba(255,255,255,0.03)">
            <Pane display="flex" alignItems="center" gap={8}>
              <Icon icon="star" size={16} />
              <Text size={400} color="muted">Session Highlights</Text>
            </Pane>
            <Pane marginTop={8} display="grid" gap={8}>
              {highlights.slice(0, 8).map((line, idx) => (
                <Pane key={`hl-${idx}`} display="flex" alignItems="center" gap={8}>
                  <Icon icon="dot" size={12} />
                  <Text size={300}>{line}</Text>
                </Pane>
              ))}
            </Pane>
          </Card>
        ) : null}
      </Card>

      <Card elevation={0} padding={16}>
        <Heading size={500}>Journal</Heading>
        <Pane marginTop={10} display="grid" gap={10}>
          <Pane>
            <Text size={300}>Match</Text>
            <Select marginTop={6} width="100%" value={coachMatchId} onChange={(e) => setCoachMatchId(e.target.value)}>
              {filteredMatches.map((match) => (
                <option key={match.id} value={match.id}>
                  {formatTime(match.gameDatetime)} · Set {match.setNumber ?? "?"} · Patch {match.patch || "?"}
                </option>
              ))}
            </Select>
          </Pane>

          <Pane>
            <Text size={300}>Plan at 3-2</Text>
            <Textarea value={planAt32} onChange={(e) => setPlanAt32(e.target.value)} marginTop={6} minHeight={80} />
          </Pane>

          <Pane>
            <Text size={300}>What actually happened</Text>
            <Textarea value={executedPlan} onChange={(e) => setExecutedPlan(e.target.value)} marginTop={6} minHeight={80} />
          </Pane>

          <Pane display="flex" gap={16} flexWrap="wrap">
            <Checkbox checked={tagPanicRoll} onChange={(e) => setTagPanicRoll(e.target.checked)} label="Panic roll" />
            <Checkbox checked={tagMissedGift} onChange={(e) => setTagMissedGift(e.target.checked)} label="Missed gift" />
            <Checkbox checked={tagBothRoll} onChange={(e) => setTagBothRoll(e.target.checked)} label="Both rolled same stage" />
          </Pane>

          <Pane display="flex" gap={10} alignItems="center" flexWrap="wrap">
            <Button appearance="primary" onClick={submitJournal} disabled={!duoId || coachSaving}>
              Save Journal
            </Button>
            {coachSaving ? <Spinner size={16} /> : null}
          </Pane>
        </Pane>
      </Card>

      <Card elevation={0} padding={16}>
        <Heading size={500}>Quick Event</Heading>
        <Pane marginTop={10} display="flex" gap={10} flexWrap="wrap" alignItems="end">
          <Pane>
            <Text size={300}>Stage</Text>
            <TextInput marginTop={6} value={quickStage} onChange={(e) => setQuickStage(e.target.value)} />
          </Pane>
          <Pane>
            <Text size={300}>Actor</Text>
            <Select marginTop={6} value={quickActor} onChange={(e) => setQuickActor(e.target.value)}>
              <option value="A">{DISPLAY_NAME_A}</option>
              <option value="B">{DISPLAY_NAME_B}</option>
            </Select>
          </Pane>
          <Button onClick={() => submitQuickEvent("gift_sent")} disabled={!duoId || coachSaving}>Log Gift</Button>
          <Button onClick={() => submitQuickEvent("rescue_arrival")} disabled={!duoId || coachSaving}>Log Rescue</Button>
          <Button onClick={() => submitQuickEvent("roll_down")} disabled={!duoId || coachSaving}>Log Roll Down</Button>
        </Pane>
      </Card>

      {coachMessage ? <Alert intent="none" title={coachMessage} /> : null}
    </Pane>
  );
}

