export interface AnkiConnectResponse {
  result: any;
  error: string | null;
}

async function testAnkiConnect(): Promise<boolean> {
  try {
    const response = await fetch(ANKI_CONNECT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify({
        action: 'version',
        version: 6
      }),
    });

    if (!response.ok) {
      console.error('AnkiConnect HTTP error:', response.status, response.statusText);
      return false;
    }

    const data = await response.json();
    console.log('AnkiConnect version check response:', data);
    return !data.error;
  } catch (error) {
    console.error('Failed to connect to AnkiConnect:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
    return false;
  }
}

const ANKI_CONNECT_URL = 'http://localhost:8765';

export async function addNoteToAnki(front: string, back: string): Promise<boolean> {
  try {
    // First verify AnkiConnect is available
    const isAvailable = await testAnkiConnect();
    if (!isAvailable) {
      console.error('AnkiConnect is not available. Is Anki running?');
      return false;
    }

    console.log('Adding note to Anki...');
    const requestBody = {
      action: 'addNote',
      version: 6,
      params: {
        note: {
          deckName: '...TinTuiT',
          modelName: 'Basic',
          fields: {
            Front: front,
            Back: back,
          },
          options: {
            allowDuplicate: false,
          },
        },
      },
    };

    console.log('Sending request to AnkiConnect:', requestBody);

    const response = await fetch(ANKI_CONNECT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      console.error('HTTP error:', response.status, response.statusText);
      return false;
    }

    const data: AnkiConnectResponse = await response.json();
    console.log('AnkiConnect response:', data);
    
    if (data.error) {
      console.error('AnkiConnect error:', data.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to connect to AnkiConnect:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
}
