"use client";

import { useState } from "react";
import { GraduationCap, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { EventDialog, type CourseOption, type EventDraft } from "../event-dialog";
import { ExamDialog } from "../exam-dialog";
import { EventItem, type EventItemData } from "../items";
import { EmptyState } from "../ui/card";

export function QuickActions({ courses }: { courses: CourseOption[] }) {
  const [ev, setEv] = useState(false);
  const [ex, setEx] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setEx(true)}>
        <GraduationCap /> <span className="hidden sm:inline">Partiel</span>
      </Button>
      <Button size="sm" onClick={() => setEv(true)}>
        <Plus /> <span className="hidden sm:inline">Événement</span>
      </Button>
      <EventDialog open={ev} onClose={() => setEv(false)} courses={courses} />
      <ExamDialog open={ex} onClose={() => setEx(false)} courses={courses} />
    </>
  );
}

export function EventList({
  events, courses, empty, showDate = true,
}: { events: (EventItemData & { courseId: number | null })[]; courses: CourseOption[]; empty: string; showDate?: boolean }) {
  const [edit, setEdit] = useState<EventDraft | null>(null);
  if (!events.length) return <EmptyState>{empty}</EmptyState>;
  return (
    <>
      <ul className="space-y-0.5">
        {events.map((e) => (
          <EventItem
            key={e.id}
            e={e}
            showDate={showDate}
            onOpen={() =>
              setEdit({
                id: e.id, courseId: e.courseId, kind: e.kind, title: e.title, description: e.description,
                startsAt: e.startsAt, allDay: e.allDay, linkedSessionType: e.linkedSessionType,
              })
            }
          />
        ))}
      </ul>
      <EventDialog open={!!edit} onClose={() => setEdit(null)} courses={courses} initial={edit} />
    </>
  );
}
