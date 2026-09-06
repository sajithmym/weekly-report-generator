import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime, formatMinutes } from "@/lib/utils";
import type { Report, ReportContentData } from "@/types";
import { REVIEW_ACTIONS } from "@/constants";
import { REPORT_SETTINGS } from "@/lib/settings";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
const Empty = () => (
  <p className="text-sm text-muted-foreground">None reported.</p>
);

/** Identical field order for current reports and immutable historical snapshots. */
export function ReportContent({ content }: { content: ReportContentData }) {
  return (
    <div className="space-y-5">
      <Section title="Week and project">
        <p>
          {content.weekStart
            ? formatDate(content.weekStart)
            : "Date unavailable"}{" "}
          – {content.weekEnd ? formatDate(content.weekEnd) : "Date unavailable"}
        </p>
        <p className="text-sm text-muted-foreground">
          {content.projectName ||
            content.project?.name ||
            "No project selected"}
        </p>
      </Section>
      <Section title={REPORT_SETTINGS.taskSectionTitle}>
        {content.tasks?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <caption className="sr-only">
                Planned and actual task progress, time, and deliverables
              </caption>
              <thead>
                <tr>
                  {[
                    "Task",
                    "Priority",
                    "Planned %",
                    "Actual %",
                    "Status",
                    "Planned time",
                    "Time spent",
                    "Deliverable",
                  ].map((label) => (
                    <th key={label} scope="col" className="border-b p-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {content.tasks.map((task, index) => (
                  <tr key={task.id || index}>
                    <td className="border-b p-2 whitespace-pre-wrap">
                      {task.taskName}
                    </td>
                    <td className="border-b p-2">
                      {task.priority ?? "Unavailable"}
                    </td>
                    <td className="border-b p-2">
                      {task.plannedPercentage ?? "—"}
                    </td>
                    <td className="border-b p-2">
                      {task.actualPercentage ?? "—"}
                    </td>
                    <td className="border-b p-2">
                      {task.status?.replaceAll("_", " ") ?? "Unavailable"}
                    </td>
                    <td className="border-b p-2">
                      {task.plannedMinutes === undefined
                        ? "—"
                        : formatMinutes(task.plannedMinutes)}
                    </td>
                    <td className="border-b p-2">
                      {task.actualMinutes === undefined
                        ? "—"
                        : formatMinutes(task.actualMinutes)}
                    </td>
                    <td className="border-b p-2 whitespace-pre-wrap break-words">
                      {task.deliverable || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </Section>
      <Section title="Tasks planned for next week">
        {content.nextWeekTasks?.length ? (
          <ol className="list-decimal space-y-2 pl-5">
            {content.nextWeekTasks.map((task, index) => (
              <li key={task.id || index}>{task.description}</li>
            ))}
          </ol>
        ) : (
          <Empty />
        )}
      </Section>
      <Section title="Blockers and challenges">
        {content.blockers?.length ? (
          <ul className="space-y-2">
            {content.blockers.map((blocker, index) => (
              <li key={blocker.id || index}>
                <p className="whitespace-pre-wrap">{blocker.description}</p>
                <p className="text-sm font-medium">
                  {blocker.isKeyIssue && "Key issue · "}
                  {blocker.isResolved ? "Resolved" : "Open"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <Empty />
        )}
      </Section>
      <Section title="Achievements and highlights">
        {content.achievements?.length ? (
          <ul className="space-y-2">
            {content.achievements.map((achievement, index) => (
              <li key={achievement.id || index}>
                <p className="whitespace-pre-wrap">{achievement.description}</p>
                {achievement.isKeyAchievement && (
                  <p className="text-sm font-medium">Key achievement</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty />
        )}
      </Section>
      <Section title="Hours worked by task type">
        {content.workHours?.length ? (
          <div className="space-y-2">
            {content.workHours.map((hour, index) => (
              <p key={hour.id || index} className="flex justify-between gap-4">
                <span>{hour.type}</span>
                <span>{formatMinutes(hour.minutes)}</span>
              </p>
            ))}
            <p className="border-t pt-2 font-medium">
              Total:{" "}
              {formatMinutes(
                content.workHours.reduce((sum, hour) => sum + hour.minutes, 0),
              )}
            </p>
          </div>
        ) : (
          <Empty />
        )}
      </Section>
      <Section title="Notes and links">
        {content.notes ? (
          <p className="whitespace-pre-wrap break-words">{content.notes}</p>
        ) : (
          <Empty />
        )}
      </Section>
    </div>
  );
}

export function ReportHistory({ report }: { report: Report }) {
  return (
    <div className="space-y-5">
      <Section title="Version history">
        {report.versions?.length ? (
          <div className="space-y-3">
            {report.versions.map((version) => (
              <details
                id={`version-${version.versionNumber}`}
                key={version.id}
                className="rounded-lg border p-4"
              >
                <summary className="cursor-pointer font-medium">
                  Version {version.versionNumber}
                  {version.versionNumber === report.latestVersionNumber
                    ? " (latest submission)"
                    : ""}{" "}
                  · {formatDateTime(version.submittedAt)}
                </summary>
                <div className="mt-4 space-y-4">
                  {version.snapshotJson.nextWeekTasks === undefined && (
                    <p
                      role="note"
                      className="rounded border border-amber-300 bg-amber-50 p-3 text-sm"
                    >
                      This legacy snapshot was saved with incomplete fields.
                      Unavailable historical values have not been reconstructed.
                    </p>
                  )}
                  <ReportContent content={version.snapshotJson} />
                  {report.reviews
                    ?.filter((review) => review.reportVersionId === version.id)
                    .map((review) => (
                      <div className="rounded border p-3" key={review.id}>
                        <p className="font-medium">
                          {review.reviewer?.name} ·{" "}
                          {review.action === REVIEW_ACTIONS.APPROVED
                            ? "Approved"
                            : "Changes requested"}
                        </p>
                        <p>{formatDateTime(review.createdAt)}</p>
                        <p className="whitespace-pre-wrap">{review.comment}</p>
                      </div>
                    ))}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        )}
      </Section>
      <Section title="Review history">
        {report.reviews?.length ? (
          <div className="space-y-3">
            {report.reviews.map((review) => {
              const version = report.versions?.find(
                (item) => item.id === review.reportVersionId,
              );
              return (
                <article key={review.id} className="rounded border p-3">
                  <p className="font-medium">
                    {review.reviewer?.name} ·{" "}
                    {review.action === REVIEW_ACTIONS.APPROVED
                      ? "Approved"
                      : "Changes requested"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(review.createdAt)} ·{" "}
                    {version
                      ? `Version ${version.versionNumber}`
                      : "Legacy review without version association"}
                  </p>
                  {review.comment && (
                    <p className="mt-2 whitespace-pre-wrap">{review.comment}</p>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <Empty />
        )}
      </Section>
    </div>
  );
}
