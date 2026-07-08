import { NextRequest, NextResponse } from 'next/server';
import { fetchYouTubeTranscript } from '@/actions/youtube';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
        return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
    }

    try {
        console.log(`[API/Transcript] Requesting transcript for video: ${videoId}`);
        const transcript = await fetchYouTubeTranscript(`https://www.youtube.com/watch?v=${videoId}`);

        if (transcript) {
            return NextResponse.json({ transcript });
        } else {
            return NextResponse.json({
                error: 'No transcripts found',
                details: 'This video does not have English captions (manual or auto-generated), or the fallback services failed.'
            }, { status: 404 });
        }

    } catch (error) {
        console.error('[API/Transcript] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch transcript', details: String(error) }, { status: 500 });
    }
}
