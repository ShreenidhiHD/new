/**
 * Row geometry for vertical virtualization. Uniform heights take an O(1) fast
 * path; otherwise prefix sums give O(log n) lookups.
 */
export function createRowSizes(count, uniformHeight, heightAt) {
    if (!heightAt) {
        return {
            count,
            total: count * uniformHeight,
            offset: (index) => index * uniformHeight,
            height: () => uniformHeight,
            indexAt: (y) => (count === 0 ? 0 : Math.min(count - 1, Math.max(0, Math.floor(y / uniformHeight)))),
        };
    }
    const offsets = new Float64Array(count + 1);
    for (let i = 0; i < count; i += 1) offsets[i + 1] = offsets[i] + heightAt(i);
    return {
        count,
        total: offsets[count],
        offset: (index) => offsets[Math.max(0, Math.min(count, index))],
        height: (index) => offsets[index + 1] - offsets[index],
        indexAt: (y) => {
            if (count === 0) return 0;
            let lo = 0;
            let hi = count - 1;
            while (lo < hi) {
                const mid = (lo + hi + 1) >> 1;
                if (offsets[mid] <= y) lo = mid;
                else hi = mid - 1;
            }
            return lo;
        },
    };
}
