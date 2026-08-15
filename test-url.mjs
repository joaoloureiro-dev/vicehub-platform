console.log(process.env.DATABASE_URL);

try {
    const url = new URL(process.env.DATABASE_URL);

    console.log('Protocol:', url.protocol);
    console.log('Host:', url.host);
    console.log('Path:', url.pathname);

    console.log('URL OK');
} catch (error) {
    console.error(error);
}