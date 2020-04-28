const axios = require("axios");
const crypto = require("crypto");
const moment = require("moment");
const jwt = require("jsonwebtoken");

const BR2NL = /<br \/>/g;

class Profile {
  constructor(profile) {
    this.manifestDate = 0;
    this.api = axios.create({
      baseURL: profile.url,
      responseType: "json",
      headers: {
        ...this.getManifestHeaders(),
      },
    });
    this.username = profile.username;
    this.password = profile.password;
    this.subjectMapping = profile.subjectMapping;
    this.loginExpires = 0;
    this.yearId = 0;
    this.summaries = [];
    this.tasks = [];
  }

  async updateSummaries() {
    await this.login();
    const { data: summaries } = await this.api.get(
      `api/sumarios/${this.yearId}/1/0/${moment().format("DD-MM-YYYY")}`
    );
    this.summaries = summaries.Sumarios.map((summary) => ({
      profile: this,
      channelId: this.subjectMapping[summary.Disciplina],
      number: summary.Numero,
      description: summary.Descricao,
      date: summary.Data,
      subject: summary.Disciplina,
      attachments: summary.Anexos.map((attachment) => ({
        id: attachment.RequestAnexo.split("/")[4],
        name: attachment.Nome,
        request: attachment.RequestAnexo,
      })),
    }))
      .filter((summary) => !!summary.channelId)
      .reverse();
  }

  async updateTasks() {
    await this.login();
    const { data: subjects } = await this.api.get(
      `api/adenda/disciplinas/${this.yearId}/1`
    );
    const tasks = await Promise.all(
      subjects.map(async (subject) => {
        // Looks like they have a typo
        if (subject.NumAdendas === 0) return [];

        // e.g. "Matemática A (3)"
        const subjectName = subject.Disciplina.replace(
          ` (${subject.NumAdendas})`,
          ``
        );
        const channelId = this.subjectMapping[subjectName];

        if (!channelId) return [];

        const { data: tasks } = await this.api.get(
          `api/adenda/${this.yearId}/1/${subject.IdDisciplina}`
        );

        const now = moment();

        return tasks
          .filter((task) => now.isSame(task.DataData, "day"))
          .map((task) => ({
            profile: this,
            channelId,
            id: task.Id,
            title: task.Tipo,
            description: task.Descricao.replace(BR2NL, `\n`),
            date: task.DataData,
            subject: subjectName,
            attachments: task.Anexos.map((attachment) => ({
              id: `${attachment.IdAnexo}`,
              name: attachment.Nome,
              request: `api/adenda/download/${attachment.IdAnexo}/${attachment.Nome}/1`,
            })),
          }))
          .reverse();
      })
    );

    this.tasks = tasks.flat();
  }

  async getAttachment(request) {
    try {
      await this.login();
      const { data } = await this.api.get(request);

      if (data.rpt) return Buffer.from(data.rpt, "base64");

      if (data.RequestFile) {
        const response = await this.api.get(data.RequestFile, {
          responseType: "arraybuffer",
        });
        return Buffer.from(response.data, "binary");
      }
    } catch (e) {
      console.error(e);
      console.error("Error while fetching attachment");
    }

    return null;
  }

  async login() {
    try {
      // Already logged in
      if (Date.now() / 1000 < this.loginExpires) return;
      console.log(`Logging in to InovarMais as ${this.username}`);

      if (this.manifestDate != new Date().getDate()) {
        const headers = this.getManifestHeaders();
        Object.keys(headers).forEach((key) => {
          this.api.defaults.headers[key] = headers[key];
        });
      }

      const { data } = await this.api.post("api/loginFU", {
        authorization: Buffer.from(
          `${this.username}:${this.password}`
        ).toString("base64"),
      });

      this.api.defaults.headers.common["Authorization"] = `Bearer${data.token}`;
      this.yearId = data.Matriculas[0].MatriculaId;

      const decoded = jwt.decode(data.token);
      this.loginExpires = decoded.Exp;
    } catch (e) {
      console.error(e);
      console.error(`Failed to login into Inovar for ${this.username}`);
    }
  }

  getManifestHeaders() {
    // InovarMais might change this; needs to be manually updated.
    const key = "0c24b08e-d78b-4d53-96a6-68db2bf2611f";
    const hmac = crypto.createHmac("sha256", key);
    hmac.update(moment().format("YYYYMMDD"));
    this.manifestDate = new Date().getDate();
    return { "X-FESTMANI": hmac.digest("base64") };
  }
}

module.exports = Profile;
