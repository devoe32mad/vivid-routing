const { Pool } = require("pg");

const MCA_SLUG = "mason-classical-academy-concept";

async function applyMasonImages() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await pool.query(`
      UPDATE organizations
      SET
        public_logo_url =
          'https://masonacademy.com/pics/header_logo.png',
        updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(TRIM(slug)) = $1
    `, [MCA_SLUG]);

    await pool.query(`
      UPDATE organization_programs program
      SET
        public_image_url = CASE program.name
          WHEN 'Campus'
            THEN 'https://masonacademy.com/rotating_images/2353/2353_144_608_0_40.jpg'
          WHEN 'Athletics'
            THEN 'https://masonacademy.com/rotating_images/2353/2353_149_609_0_0.jpg'
          WHEN 'Events & Community'
            THEN 'https://masonacademy.com/album///2026/05/21/1/34638177_f_288x206.jpg'
          ELSE program.public_image_url
        END,
        updated_at = CURRENT_TIMESTAMP
      FROM organizations organization
      WHERE program.organization_id = organization.id
        AND LOWER(TRIM(organization.slug)) = $1
        AND program.name IN (
          'Campus',
          'Athletics',
          'Events & Community'
        )
    `, [MCA_SLUG]);
  } finally {
    await pool.end();
  }
}

applyMasonImages().catch(error => {
  console.error("MCA MARKETPLACE IMAGES ERROR:", error);
  process.exitCode = 1;
});
