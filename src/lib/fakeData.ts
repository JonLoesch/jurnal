import { mapObject } from "./ mapObject"

interface Entry {
    date: string
    posts: () => Post[]
    values: () => Value[]
}
interface Post {
    text: string
    entry: () => Entry
}
interface Value {
    zeroToTen: number
    entry: () => Entry
    metric: () => Metric
}
interface Metric {
    name: string
    values: () => Value[]
    goal: () => Goal[]
}
interface Goal {
    metric: () => Metric
    theme: () => Theme
}
interface Theme {
    goals: () => Goal[]
}

type MyMetrics = 'mood' | 'sleep' | 'eat' | 'move' | 'talk' | 'made';

export const data = compile({
    'Sep 23': {
        mood: 9,
        sleep: 7,
        eat: 7,
        move: 8,
        talk: 10,
        made: 7,
    },
    'Sep 24': {
        mood: 8,
        sleep: 5,
        eat: 5,
        move: 6,
        talk: 3,
        made: 10,
    },
    
}, {
    eat: 'Ate Well',
    made: 'Was Productive',
    mood: 'General Mood',
    move: 'Excersized',
    sleep: 'Slept well',
    talk: 'Socially Active',
});

function compile(days: Record<string, Partial<Record<MyMetrics, number>>>, metrics: Record<MyMetrics, string>): Data {
    const mets = mapObject(metrics, m => {
        const values: Value[] = [];
        return {
            name: m,
            values: () => values,
            goal: () => [],
            addValue(x: Value) { values.push(x); }
        }
    });
    const ents = mapObject(days, (d, date) => {
        const values: Value[] = [];
        return {
            date,
            posts: () => [],
            values: () => values,
            addValue(x: Value) { values.push(x); }
        }
    });
    for (const date in days) {
        for (const m in days[date]) {
            const v : Value = {
                entry: () => ents[date]!,
                metric: () => mets[m as MyMetrics]!,
                zeroToTen: days[date]![m as MyMetrics]!,
            }
            ents[date]?.addValue(v);
            mets[m as MyMetrics]?.addValue(v);
        }
    }
    return {
        entries: Object.values(ents),
        metrics: Object.values(mets),
    }
}

interface Data {
    entries: Entry[]
    metrics: Metric[]
}
